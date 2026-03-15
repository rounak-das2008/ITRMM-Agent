import os
import pandas as pd
from langchain_community.document_loaders import PlaywrightURLLoader
from langchain_google_vertexai import ChatVertexAI
from langchain_core.messages import SystemMessage, HumanMessage
from langchain_core.prompts import PromptTemplate
from langchain_core.output_parsers import PydanticOutputParser
from pydantic import BaseModel, Field

# Define Pydantic model for LLM output
class ControlAssessmentResult(BaseModel):
    detailed_response: str = Field(description="Detailed response on how the control is implemented based on the provided documents.")
    evidence_link: str = Field(description="Link or name of the document(s) serving as evidence/artifacts. e.g. @[doc_name.md]")
    risk_rating: str = Field(description="Risk Rating: Low, Medium, High, or Critical. Determined based on the completeness of the control implementation.")

class ITRMMAgent:
    def __init__(self, urls: list[str] = None):
        self.llm = ChatVertexAI(model_name="gemini-2.5-flash", temperature=0.2)
        
        # Default URLs if none provided
        if not urls:
            self.urls = [
                "http://localhost:3000/en/azure-aks-3tier-architecture-documentation",
                "http://localhost:3000/en/azure-aks-support-pack",
                "http://localhost:3000/en/enterprise-architecture-payment-systems"
            ]
        else:
            self.urls = urls
            
        self.parser = PydanticOutputParser(pydantic_object=ControlAssessmentResult)
        
        # Determine the backend directory to resolve the CSV path correctly
        backend_dir = os.path.dirname(os.path.abspath(__file__))
        project_root = os.path.dirname(backend_dir)
        self.default_csv_path = os.path.join(project_root, "Comprehensive_Production_GoLive_Risk_Assessment 1 - Sheet1.csv")
        self.output_csv_path = os.path.join(project_root, "ITRMM_Assessment_Results.csv")
        
        # Load and index documents
        self._init_vector_store()

    def _init_vector_store(self):
        # We no longer use a VectorDB! We will inject the full context
        print(f"Scraping dynamic documents from URLs: {self.urls}")
        
        if not self.urls:
            self.full_context = ""
            print("No URLs configured. Context is empty.")
            return

        documents = []
        try:
            loader = PlaywrightURLLoader(urls=self.urls, remove_selectors=["header", "footer", "nav", "aside"])
            documents = loader.load()
            self.full_context = "\n\n".join([f"Source URL: {doc.metadata.get('source', 'Unknown')}\nContent:\n{doc.page_content}" for doc in documents])
            print(f"Successfully loaded {len(self.full_context)} characters of context from Wiki.js pages.")
        except Exception as e:
            print(f"Failed to load URLs with Playwright: {e}")
            self.full_context = ""

    def assess_control(self, control_area: str, question: str, user_instructions: str = "") -> dict:
        if not self.full_context:
            print("Warning: No context available for assessment.")
            return {
                "detailed_response": "No documentation context was loaded. Please ensure Wiki.js is running and accessible.",
                "evidence_link": "",
                "risk_rating": "Critical"
            }

        context = self.full_context
        urls_str = "\n".join(self.urls)

        # Build optional user instructions block
        instructions_block = ""
        if user_instructions:
            instructions_block = f"""
        USER INSTRUCTIONS (follow these carefully):
        {user_instructions}
        """

        system_prompt = f"""
        You are the application development team responding to an ITRMM (IT Risk Management and Mitigation) assessment for ING Bank.
        You will be given a specific risk control question. You must answer it based ONLY on the provided Wiki Documentation Context below.
        
        CRITICAL WRITING STYLE:
        - Write ALL responses in FIRST PERSON as if YOU are the team that built and operates this application.
        - Use phrases like "Team has implemented", "Our application uses...", "We ensure...", "Our team follows...".
        - NEVER use third person like "The application uses..." or "The system implements...".
        - Be authoritative and confident — you own and operate this system.
        {instructions_block}
        Source Document URLs:
        {urls_str}
        
        --- WIKI DOCUMENTATION CONTEXT ---
        {context}
        ----------------------------------
        
        Based on the context, provide a JSON response with three fields:
        1. "detailed_response": A first-person explanation of how the control is implemented.
        2. "evidence_link": The specific URL from the Source Document URLs above that provides the evidence. If the information spans multiple, list them. If no evidence is found, write "N/A".
        3. "risk_rating": Rate the residual risk as "Low", "Medium", or "High" based on the provided evidence. If the control is completely unaddressed, the risk is typically "High". If fully mitigated according to the docs, it is "Low".
        
        Please return ONLY valid JSON in this exact format. Do not use markdown blocks like `json ...`.
        {{
            "detailed_response": "...",
            "evidence_link": "...",
            "risk_rating": "..."
        }}
        """
        
        # Query the LLM
        try:
            response = self.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=f"Control Question: {question}")
            ])
            # The parser expects the exact Pydantic fields
            result = self.parser.parse(response.content)
            return result.model_dump()
        except Exception as e:
            print(f"Error processing control '{control_area}': {e}")
            return {
                "detailed_response": f"Error during processing: {str(e)}",
                "evidence_link": "",
                "risk_rating": "Critical"
            }

    def chat(self, user_message: str) -> str:
        """
        Processes a generic chat message from the user against the full Wiki.js context.
        """
        if not self.full_context:
            return "I'm sorry, I couldn't access the connected Wiki documentation. Please make sure the Wiki.js container is running."

        context = self.full_context
        urls_str = "\n".join(self.urls)
        
        system_prompt = f"""
        You are the ITRMM (IT Risk Management and Mitigation) Agent for ING Bank. 
        Your role is to answer questions about architecture, compliance, and controls based ONLY on the provided context below.
        
        CRITICAL INSTRUCTIONS:
        1. Provide HIGHLY DETAILED and comprehensive answers based on the context.
        2. Format your response beautifully using Markdown: use clear headers (###), bullet points, and bold text for reading clarity. Always use proper spacing.
        3. If the answer is not contained in the context, politely state that you do not have that information.
        4. Always cite the exact source URLs provided at the end of your response.
        
        Source URLs:
        {urls_str}
        
        --- WIKI DOCUMENTATION CONTEXT ---
        {context}
        ----------------------------------
        """
        try:
            response = self.llm.invoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ])
            return response.content
        except Exception as e:
            print(f"Error during chat interaction: {e}")
            return "An error occurred while communicating with the Vertex AI LLM."

    def process_csv(self, csv_path: str, output_path: str, user_instructions: str = ""):
        df = pd.read_csv(csv_path)
        
        results = []
        for index, row in df.iterrows():
            area = row.get("Control Area", "")
            question = row.get("Question (Describe HOW control is implemented)", "")
            
            if pd.isna(question) or str(question).strip() == "":
                results.append(row.to_dict())
                continue
                
            print(f"Assessing: {area} - {question}")
            assessment = self.assess_control(str(area), str(question), user_instructions=user_instructions)
            
            row_dict = row.to_dict()
            row_dict["Detailed Response"] = assessment["detailed_response"]
            row_dict["Evidence / Artifacts Link"] = assessment["evidence_link"]
            row_dict["Risk Rating (Low/Medium/High/Critical)"] = assessment["risk_rating"]
            results.append(row_dict)
            
        # Save to output path
        out_df = pd.DataFrame(results)
        out_df.to_csv(output_path, index=False)
        return output_path
