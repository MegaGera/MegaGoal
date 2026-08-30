import {
  getOnzeWatchedStatus,
  parseOnzePlayMode,
  parseOnzeWatchedFilters,
  pickRandomOnzeWatchedMatch,
  searchOnzeWatchedMatches,
} from '../services/onzeWatchedMatchService.js';
import { parseMatchPagination } from '../services/matchPagination.js';

export const getWatchedStatus = async (req, res) => {
  try {
    const username = req.validateData.username;
    const status = await getOnzeWatchedStatus(username);
    res.send(status);
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.message });
  }
};

export const searchWatchedMatches = async (req, res) => {
  try {
    const username = req.validateData.username;
    const mode = parseOnzePlayMode(req.query.mode);
    const filters = parseOnzeWatchedFilters(req.query);
    const pagination = parseMatchPagination(req.query);
    const result = await searchOnzeWatchedMatches(username, filters, mode, pagination);
    res.send(result);
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.message });
  }
};

export const getRandomWatchedMatch = async (req, res) => {
  try {
    const username = req.validateData.username;
    const mode = parseOnzePlayMode(req.query.mode);
    const filters = parseOnzeWatchedFilters(req.query);
    const match = await pickRandomOnzeWatchedMatch(username, filters, mode);
    res.send(match);
  } catch (error) {
    res.status(error.status ?? 500).json({ message: error.message });
  }
};
