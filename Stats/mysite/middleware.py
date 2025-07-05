"""
Middleware file
"""
import requests
import os
from django.http import HttpResponseForbidden

class CustomAuthenticationMiddleware:
  def __init__(self, get_response):
    self.get_response = get_response

  def __call__(self, request):
    # Check if the request is over HTTPS
    if not request.is_secure():
      return self.get_response(request)

    # Get the cookie from the request
    cookie_value = request.COOKIES.get('access_token')
    
    if not cookie_value:
      return HttpResponseForbidden('Can\'t validate token')

    # Make a request to the authentication server
    auth_server_url = os.getenv('VALIDATE_URI')
    if not auth_server_url:
      return HttpResponseForbidden('VALIDATE_URI not configured')
    
    headers = {
      'Cookie': f'access_token={cookie_value}'
    }
    try:
      auth_response = requests.get(auth_server_url, headers=headers)
    except requests.exceptions.RequestException as e:
      return HttpResponseForbidden(f'Authentication server request failed: {str(e)}')

    # Check if the authentication was successful
    if auth_response.status_code != 200:
      return HttpResponseForbidden('Invalid authentication token')

    # Add the validate data to the request
    data = auth_response.json()
    request.validateData = data
    response = self.get_response(request)

    return response