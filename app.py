import settings
from models import Base
from routes import People, Events, Jobs, StaticFiles

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from bottle import Bottle

engine = create_engine(settings.dbpath)
Base.metadata.bind = engine

DBSession = sessionmaker()
DBSession.bind = engine
session = DBSession()

app = Bottle()

People(app, session)
Events(app, session)
Jobs(app, session)
StaticFiles(app, settings.staticroot)

app.run(host=settings.ip, port=settings.port, reloader=True);

