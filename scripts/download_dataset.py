import os
from roboflow import Roboflow

key = os.environ.get("ROBOFLOW_API_KEY")
if not key:
    raise SystemExit("ROBOFLOW_API_KEY not set")

rf = Roboflow(api_key=key)
project = rf.workspace("sph919-uowmail-edu-au").project("snapwell-ingredients")
version = project.version(2)
dataset = version.download("yolov8", location="data/snapwell-v2")
print("downloaded to:", dataset.location)
