"""
WSGI config for mysite project.

It exposes the WSGI callable as a module-level variable named ``application``.

For more information on this file, see
https://docs.djangoproject.com/en/5.1/howto/deployment/wsgi/

Unicorn is a WSGI server that is used to serve the Django application.
"""

import os

from django.core.wsgi import get_wsgi_application
print("--------------------------------------------")
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'mysite.settings_production')

application = get_wsgi_application()
