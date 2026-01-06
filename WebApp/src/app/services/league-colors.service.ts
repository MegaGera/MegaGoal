/*
  Service to manage league colors dynamically
*/

import { Injectable } from '@angular/core';
import { League } from '../models/league';
import { MegaGoalService } from './megagoal.service';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class LeagueColorsService {

  // Map league IDs to colors (card_main_color, card_trans_color)
  private leagueColorsMap: Map<number, { card_main_color: string, card_trans_color: string }> = new Map();

  // Default colors for leagues without colors set
  private defaultColors = {
    card_main_color: '#000000',
    card_trans_color: 'rgba(0, 0, 0, 0.9)'
  };

  // Flag to track if colors are being loaded
  private isLoadingColors: boolean = false;
  private colorsLoadPromise: Promise<void> | null = null;

  constructor(private megaGoalService: MegaGoalService) { }

  /*
    Set league colors map from top leagues data
    This should be called when top leagues are loaded
  */
  setLeagueColors(leagues: League[]): void {
    this.leagueColorsMap.clear();
    
    leagues.forEach(league => {
      const leagueId = league.league.id;
      
      // Note: colors are now in league.colors object from server (added dynamically)
      // Handle both new format (colors object) and legacy format (direct properties)
      const colors = (league as any).colors;
      if (colors) {
        // New format: colors.card_main_color and colors.card_trans_color
        if (colors.card_main_color && colors.card_trans_color) {
          this.leagueColorsMap.set(leagueId, {
            card_main_color: colors.card_main_color,
            card_trans_color: colors.card_trans_color
          });
        }
        // Legacy format fallback: colors.main_color and colors.transparent_color
        else if (colors.main_color && colors.transparent_color) {
          this.leagueColorsMap.set(leagueId, {
            card_main_color: colors.main_color,
            card_trans_color: colors.transparent_color
          });
        }
      }
    });
  }

  /*
    Get colors for a specific league ID
    Returns default colors if league not found
    If map is empty, fetches colors from API (async, but returns immediately)
    The colors will be available on next call after API completes
  */
  getLeagueColors(leagueId: number): { card_main_color: string, card_trans_color: string } {
    // If map is empty, trigger async load (non-blocking)
    if (this.leagueColorsMap.size === 0 && !this.isLoadingColors && !this.colorsLoadPromise) {
      this.loadColorsFromAPI();
    }
    
    // Return colors if available, otherwise default
    // Note: If API is still loading, this will return defaults until next call
    return this.leagueColorsMap.get(leagueId) || this.defaultColors;
  }

  /*
    Get colors for a specific league ID (async version)
    Waits for colors to load if map is empty
    Use this if you need to ensure colors are loaded before rendering
  */
  async getLeagueColorsAsync(leagueId: number): Promise<{ card_main_color: string, card_trans_color: string }> {
    // If map is empty, wait for colors to load
    if (this.leagueColorsMap.size === 0) {
      await this.loadColorsFromAPI();
    }
    
    return this.leagueColorsMap.get(leagueId) || this.defaultColors;
  }

  /*
    Load colors from API if map is empty
    Uses a promise to prevent multiple simultaneous calls
  */
  private async loadColorsFromAPI(): Promise<void> {
    // If already loading, wait for that promise
    if (this.colorsLoadPromise) {
      return this.colorsLoadPromise;
    }

    // If map already has data, no need to load
    if (this.leagueColorsMap.size > 0) {
      return Promise.resolve();
    }

    this.isLoadingColors = true;
    this.colorsLoadPromise = firstValueFrom(this.megaGoalService.getLeagueColors())
      .then((colorsMap) => {
        // Populate the map with colors from API
        Object.keys(colorsMap).forEach(leagueIdStr => {
          const leagueId = parseInt(leagueIdStr);
          const colors = colorsMap[leagueId];
          
          if (colors) {
            // New format: colors.card_main_color and colors.card_trans_color
            if (colors.card_main_color && colors.card_trans_color) {
              this.leagueColorsMap.set(leagueId, {
                card_main_color: colors.card_main_color,
                card_trans_color: colors.card_trans_color
              });
            }
            // Legacy format fallback: colors.main_color and colors.transparent_color
            else if ((colors as any).main_color && (colors as any).transparent_color) {
              this.leagueColorsMap.set(leagueId, {
                card_main_color: (colors as any).main_color,
                card_trans_color: (colors as any).transparent_color
              });
            }
          }
        });
        
        this.isLoadingColors = false;
        this.colorsLoadPromise = null;
      })
      .catch((error) => {
        console.error('Error loading league colors:', error);
        this.isLoadingColors = false;
        this.colorsLoadPromise = null;
      });

    return this.colorsLoadPromise;
  }

  /*
    Check if a league has colors set
  */
  hasLeagueColors(leagueId: number): boolean {
    return this.leagueColorsMap.has(leagueId);
  }

  /*
    Temporarily set colors for a league (for preview purposes)
    This allows updating colors without affecting the main color map
  */
  setTemporaryColors(leagueId: number, card_main_color: string, card_trans_color: string): void {
    this.leagueColorsMap.set(leagueId, {
      card_main_color: card_main_color,
      card_trans_color: card_trans_color
    });
  }
}
