# ai-service/run.py
import uvicorn
import os
import sys
from pathlib import Path

if __name__ == "__main__":
    sys.path.insert(0, str(Path(__file__).parent))
    
    port = int(os.environ.get("AI_PORT", 8000))
    
    try:
        import fastapi
    except ImportError:
        print("❌ FastAPI is not installed. Please run: pip install -r requirements.txt")
        sys.exit(1)
    
    print(f"🚀 AI Service starting on http://127.0.0.1:{port}")
    print(f"📊 Health check: http://127.0.0.1:{port}/health")
    print(f"💬 Chat endpoint: http://127.0.0.1:{port}/chat")
    
    uvicorn.run(
        "app.main:app",
        host="127.0.0.1",
        port=port,
        reload=True,
        log_level="info"
    )