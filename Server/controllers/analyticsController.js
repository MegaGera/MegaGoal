import { logPageVisit } from './logController.js';

// Log page visit
export const logPageVisitEndpoint = async (req, res) => {
  try {
    const username = req.validateData?.username || 'anonymous';
    const { page, ...pageData } = req.body;
    
    if (!page) {
      return res.status(400).json({ message: 'Page name is required' });
    }
    
    // Log the page visit to RabbitMQ
    await logPageVisit(username, page, pageData, req);
    
    res.status(200).json({ 
      message: 'Page visit logged successfully' 
    });
  } catch (error) {
    console.error('Error logging page visit:', error);
    res.status(500).json({ message: error.message });
  }
};

