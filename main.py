import joblib
import pandas as pd
from fastapi import FastAPI
from pydantic import BaseModel
from pydantic import Field as f
from typing import Literal
model=joblib.load('Mental_Health_Model.pkl') #loading the pickle file
app=FastAPI()
# first pydantic model
#request body
class StudentData(BaseModel):
    Age                    : int=f(...,ge=10,le=100)
    Gender                 : Literal['Male','Female']
    Country                : str
    Academic_Level         : Literal['Undergradute','Gradute','High School']
    Most_Used_Platform     : Literal['Facebook', 'LinkedIn', 'Instagram','Snapchat','Twitter','YouTube','TikTok','LINE', 'KakaoTalk', 'VKontakte',  'WhatsApp','WeChat']
    Purpose_Of_Use         : Literal['Networking', 'Education', 'Entertainment', 'News']
    Avg_Daily_Usage_Hours  : float=f(...,ge=6,le=24)
    Daily_Unlocks          : int=f(...,ge=0)
    Study_Hours            : float=f(...,ge=0,le=24)
    Physical_Activity_Hours: float=f(...,ge=0,le=24)
    Sleep_Hours_Per_Night  : float=f(...,ge=0,le=12)
    Stress_Level           : Literal['Low',"Medium",'High','Very High']
    
@app.get('/')
def greet():
    return {'Hello mittu'}
top_countries=['India',
 'USA',
 'Canada',
 'Australia',
 'UK',
 'Germany',
 'Mexico',
 'Turkey',
 'France',
 'Spain']
#describe what we send back
# response body
class predictionrespons(BaseModel):
    predicted_mental_health_score:float


@app.post('/predict',response_model=predictionrespons)
def predict(data:StudentData):
    country_group=data.Country if data.Country in top_countries else 'Other'
    input_row=pd.DataFrame([{
 'Age'                    :data.Age,
 'Gender'                 :data.Gender,
 'Country'                :data.Country,
 'Academic_Level'         :data.Academic_Level, 
 'Most_Used_Platform'     :data.Most_Used_Platform, 
 'Purpose_Of_Use'         :data.Purpose_Of_Use, 
 'Avg_Daily_Usage_Hours'  :data.Avg_Daily_Usage_Hours, 
 'Daily_Unlocks'          :data.Daily_Unlocks, 
 'Study_Hours'            :data.Study_Hours, 
 'Physical_Activity_Hours':data.Physical_Activity_Hours, 
 'Sleep_Hours_Per_Night'  :data.Sleep_Hours_Per_Night, 
 'Stress_Level'           :data.Stress_Level,
 'Grouped_Countries'      :country_group
    }])
    prediction=model.predict(input_row)[0]
    return predictionrespons(predicted_mental_health_score=round(float(prediction), 1))
  
  
  
# cross origin resource sharing fro connecting frontend with backend
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
       
