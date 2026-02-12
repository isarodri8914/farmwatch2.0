import os

class Config:
    SECRET_KEY = "super-secret-key"  # cámbiala luego

    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    SQLALCHEMY_DATABASE_URI = "sqlite:///" + os.path.join(BASE_DIR, "farmwatch.db")

    SQLALCHEMY_TRACK_MODIFICATIONS = False
