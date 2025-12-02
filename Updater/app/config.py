import os
from dotenv import load_dotenv
from pymongo import MongoClient

# Load environment variables from .env file
load_dotenv()

class Config:
    """Configuration class to handle environment variables and database connections"""
    
    # API Configuration
    RAPIDAPI_KEY = os.getenv('RAPIDAPI_KEY')
    RAPIDAPI_HOST = os.getenv('RAPIDAPI_HOST')
    
    # Database Configuration
    MONGODB_HOST = os.getenv('MONGODB_HOST')
    MONGODB_PORT = int(os.getenv('MONGODB_PORT', '27017'))
    MONGODB_USERNAME = os.getenv('MONGODB_USERNAME')
    MONGODB_PASSWORD = os.getenv('MONGODB_PASSWORD')
    MONGODB_DATABASE = os.getenv('MONGODB_DATABASE')
    
    @classmethod
    def get_api_headers(cls):
        """Get API headers for requests"""
        return {
            'X-RapidAPI-Key': cls.RAPIDAPI_KEY,
            'X-RapidAPI-Host': cls.RAPIDAPI_HOST
        }
    
    @classmethod
    def get_mongodb_client(cls):
        """Get MongoDB client connection"""
        print(f"Connecting to MongoDB: {cls.MONGODB_HOST}:{cls.MONGODB_PORT}")
        print(f"Username: {cls.MONGODB_USERNAME}")
        print(f"Database: {cls.MONGODB_DATABASE}")
        return MongoClient(
            cls.MONGODB_HOST, 
            cls.MONGODB_PORT, 
            username=cls.MONGODB_USERNAME,
            password=cls.MONGODB_PASSWORD
        )
    
    @classmethod
    def get_database(cls):
        """Get database instance"""
        client = cls.get_mongodb_client()
        return client[cls.MONGODB_DATABASE]
    
    @staticmethod
    def get_finished_match_status_array():
        """Get array of match statuses that indicate a finished match"""
        return ["FT", "AET", "PEN", "PST", "CANC"]

    