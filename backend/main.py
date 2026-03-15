from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import tempfile
from agent import ITRMMAgent

app = FastAPI(title="ITRMM Agent API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global agent instance
agent_instance = None

def get_agent():
    global agent_instance
    if agent_instance is None:
        try:
            agent_instance = ITRMMAgent()
        except Exception as e:
            print(f"Failed to initialize agent: {e}")
            raise HTTPException(status_code=500, detail=f"Agent initialization failed: {str(e)}")
    return agent_instance

class ChatRequest(BaseModel):
    message: str

class URLRequest(BaseModel):
    url: str

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/sources")
def get_sources():
    agent = get_agent()
    return {"urls": agent.urls}

@app.post("/api/sources")
def add_source(request: URLRequest):
    agent = get_agent()
    if request.url in agent.urls:
        raise HTTPException(status_code=400, detail="URL already exists")
    agent.urls.append(request.url)
    agent._init_vector_store() # Re-scrape memory
    return {"urls": agent.urls, "message": "Source added successfully"}

@app.delete("/api/sources")
def remove_source(request: URLRequest):
    agent = get_agent()
    if request.url not in agent.urls:
        raise HTTPException(status_code=404, detail="URL not found")
    agent.urls.remove(request.url)
    agent._init_vector_store() # Re-scrape memory
    return {"urls": agent.urls, "message": "Source removed successfully"}

@app.post("/api/chat")
def chat_endpoint(request: ChatRequest):
    agent = get_agent()
    response = agent.chat(request.message)
    return {"reply": response}

@app.post("/api/assess")
async def assess_controls(file: UploadFile = File(...), instructions: str = Form("")):
    """
    Receives a CSV or Excel file, processes each question via the agent,
    and returns a filled CSV file. Optionally accepts user instructions
    to guide response style (e.g., "keep answers crisp and short").
    """
    allowed_extensions = ('.csv', '.xlsx', '.xls')
    filename_lower = file.filename.lower()
    if not any(filename_lower.endswith(ext) for ext in allowed_extensions):
        raise HTTPException(status_code=400, detail="Only CSV and Excel (.xlsx, .xls) files are supported")
        
    try:
        # Determine file type
        is_excel = filename_lower.endswith('.xlsx') or filename_lower.endswith('.xls')
        suffix = ".xlsx" if filename_lower.endswith('.xlsx') else (".xls" if filename_lower.endswith('.xls') else ".csv")
        
        # Create temp file for input
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_input:
            content = await file.read()
            temp_input.write(content)
            input_path = temp_input.name

        # Convert Excel to CSV if needed
        if is_excel:
            import pandas as pd
            df = pd.read_excel(input_path, engine='openpyxl' if filename_lower.endswith('.xlsx') else None)
            csv_input_path = input_path.rsplit('.', 1)[0] + ".csv"
            df.to_csv(csv_input_path, index=False)
            os.remove(input_path)
            input_path = csv_input_path
            
        output_path = input_path.replace(".csv", "_results.csv")
        
        agent = get_agent()
        agent.process_csv(input_path, output_path, user_instructions=instructions)
        
        # Clean up input
        os.remove(input_path)
        
        # Build output filename
        output_filename = f"ITRMM_Results_{file.filename}"
        if not output_filename.endswith('.csv'):
            output_filename = output_filename.rsplit('.', 1)[0] + '.csv'
        
        return FileResponse(
            output_path, 
            media_type="text/csv", 
            filename=output_filename,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/docs")
def list_documents():
    """Lists the documents available in the wiki."""
    agent = get_agent()
    return {"documents": agent.urls}

# Mount the frontend directory to serve static files
frontend_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
