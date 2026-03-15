from google.cloud import aiplatform
from langchain_google_vertexai import ChatVertexAI

try:
    llm = ChatVertexAI(model_name="gemini-2.5-flash", temperature=0.2)
    response = llm.invoke("What is 1+1?")
    print("ADC works! Response:", response.content)
except Exception as e:
    print("ADC Error:", e)
