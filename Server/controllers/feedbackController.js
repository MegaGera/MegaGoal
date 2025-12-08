import { getDB } from '../config/db.js';
import { logFeedbackSubmitted, sendMailingMessage } from './logController.js';

// Submit user feedback
export const submitFeedback = async (req, res) => {
  const db = getDB();
  try {
    const feedbackData = {
      ...req.body,
      username: req.validateData?.username || 'anonymous',
      created_at: new Date()
    };
    
    const result = await db.collection('user_feedback').insertOne(feedbackData);
    console.log("Feedback submitted by user: " + feedbackData.username);
    
    // Log feedback submission to RabbitMQ
    await logFeedbackSubmitted(feedbackData.username, { ...feedbackData, _id: result.insertedId }, req);
    
    // Send mailing message if email is provided
    if (req.validateData?.email) {
      await sendMailingMessage(req.validateData.email, feedbackData.username, 'feedback');
    }
    
    res.status(201).json({ 
      id: result.insertedId,
      message: 'Feedback submitted successfully' 
    });
  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ message: error.message });
  }
}

// Get all feedback (for admin purposes)
export const getAllFeedback = async (req, res) => {
  const db = getDB();
  try {
    const result = await db.collection('user_feedback').find().sort({ created_at: -1 }).toArray();
    console.log("All feedback retrieved");
    res.send(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
} 