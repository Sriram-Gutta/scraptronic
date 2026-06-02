# PythonAnywhere WSGI entry point.
# In the PythonAnywhere web tab, point the WSGI config file at:
#   from wsgi import application
# and PythonAnywhere will serve the flask app.

import sys

# adjust this path to wherever you cloned the repo on PythonAnywhere
project_path = "/home/sriramgutta/scraptronic/backend"
if project_path not in sys.path:
    sys.path.insert(0, project_path)

from app import app as application
