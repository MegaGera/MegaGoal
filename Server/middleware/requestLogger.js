import { logUserAction } from '../controllers/logController.js';

// Middleware to automatically log API requests
const requestLogger = (req, res, next) => {
  // Store original end function
  const originalEnd = res.end;
  
  // Override end function to log after response
  res.end = async function(...args) {
    // Call original end function first
    originalEnd.apply(this, args);
    
    // Only log successful requests and exclude health checks
    if (res.statusCode < 400 && 
        !req.path.includes('/health') && 
        req.validateData?.username) {
      
      const actionMap = {
        'GET': 'VIEW',
        'POST': 'CREATE',
        'PUT': 'UPDATE',
        'PATCH': 'UPDATE',
        'DELETE': 'DELETE'
      };
      
      const action = `API_${actionMap[req.method] || req.method}`;
      const endpoint = req.path.replace(/\/\d+/g, '/:id'); // Replace IDs with :id
      
      // Log the API call (don't await to avoid slowing response)
      logUserAction(
        req.validateData.username,
        action,
        {
          endpoint: endpoint,
          method: req.method,
          statusCode: res.statusCode
        },
        {
          ip: req.ip,
          userAgent: req.get('User-Agent')
        }
      ).catch(err => {
        console.error('Failed to log API request:', err.message);
      });
    }
  };
  
  next();
};

export { requestLogger }; 