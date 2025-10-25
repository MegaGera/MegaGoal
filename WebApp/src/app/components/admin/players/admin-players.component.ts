import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgIconComponent, provideIcons } from '@ng-icons/core';
import { jamSearch, jamRefresh, jamArrowLeft, jamArrowRight } from '@ng-icons/jam-icons';

import { UpdaterService } from '../../../services/updater.service';
import { MegaGoalService } from '../../../services/megagoal.service';
import { Player } from '../../../models/player';
import { PlayersApiInfo } from '../../../models/playersApiInfo';

@Component({
  selector: 'app-admin-players',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIconComponent],
  providers: [provideIcons({ jamSearch, jamRefresh, jamArrowLeft, jamArrowRight })],
  templateUrl: './admin-players.component.html',
  styleUrl: './admin-players.component.css'
})
export class AdminPlayersComponent implements OnInit {
  
  // API Update properties
  pageInput: number = 1;
  isUpdatingPlayers: boolean = false;
  updateMessage: string = '';
  updateSuccess: boolean = false;
  
  // Players list properties
  players: Player[] = [];
  searchText: string = '';
  selectedPosition: string = '';
  selectedNationality: string = '';
  selectedTeamsFilter: string = '';
  isSearching: boolean = false;
  
  // Teams update tracking
  isUpdatingTeams: { [playerId: number]: boolean } = {};
  
  // Filter options
  availablePositions: string[] = [];
  availableNationalities: string[] = [];
  
  // Pagination properties
  currentPage: number = 1;
  itemsPerPage: number = 50;
  totalPages: number = 0;
  totalCount: number = 0;
  hasNextPage: boolean = false;
  hasPrevPage: boolean = false;
  
  // API Info properties
  playersApiInfo: PlayersApiInfo | null = null;

  constructor(
    private updaterService: UpdaterService,
    private megaGoalService: MegaGoalService
  ) {}

  ngOnInit(): void {
    this.loadPlayers();
    this.loadPlayersApiInfo();
    this.loadFilterOptions();
  }

  /**
   * Update players from API for a specific page
   */
  updatePlayers(): void {
    if (this.pageInput < 1) {
      this.updateMessage = 'Page number must be greater than 0';
      this.updateSuccess = false;
      return;
    }

    this.isUpdatingPlayers = true;
    this.updateMessage = '';
    
    this.updaterService.updatePlayers(this.pageInput).subscribe({
      next: (response: any) => {
        this.updateMessage = `Successfully updated ${response.players_added} players from page ${response.current_page} of ${response.total_pages}`;
        this.updateSuccess = true;
        this.isUpdatingPlayers = false;
        this.loadPlayersApiInfo(); // Refresh API info
      },
      error: (error: any) => {
        this.updateMessage = `Error updating players: ${error.error?.detail || error.message}`;
        this.updateSuccess = false;
        this.isUpdatingPlayers = false;
      }
    });
  }

  /**
   * Load players from database with search and pagination
   */
  loadPlayers(): void {
    this.megaGoalService.getPlayers(this.currentPage, this.itemsPerPage, this.searchText, this.selectedPosition, this.selectedNationality, this.selectedTeamsFilter).subscribe({
      next: (response: any) => {
        this.players = response.players;
        this.totalPages = response.pagination.totalPages;
        this.totalCount = response.pagination.totalCount;
        this.hasNextPage = response.pagination.hasNextPage;
        this.hasPrevPage = response.pagination.hasPrevPage;
      },
      error: (error: any) => {
        console.error('Error loading players:', error);
      }
    });
  }

  /**
   * Load players API info from settings
   */
  loadPlayersApiInfo(): void {
    this.megaGoalService.getPlayersApiInfo().subscribe({
      next: (info: any) => {
        this.playersApiInfo = info;
      },
      error: (error: any) => {
        console.error('Error loading players API info:', error);
      }
    });
  }

  /**
   * Search players by name
   */
  searchPlayers(): void {
    this.isSearching = true;
    this.currentPage = 1; // Reset to first page when searching
    this.loadPlayers();
    this.isSearching = false;
  }

  /**
   * Get players for current page (now handled by backend)
   */
  getCurrentPagePlayers(): Player[] {
    return this.players;
  }

  /**
   * Go to previous page
   */
  previousPage(): void {
    if (this.hasPrevPage) {
      this.currentPage--;
      this.loadPlayers();
    }
  }

  /**
   * Go to next page
   */
  nextPage(): void {
    if (this.hasNextPage) {
      this.currentPage++;
      this.loadPlayers();
    }
  }

  /**
   * Go to specific page
   */
  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.loadPlayers();
    }
  }

  /**
   * Get array of page numbers for pagination
   */
  getPageNumbers(): number[] {
    const pages: number[] = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, this.currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(this.totalPages, startPage + maxVisiblePages - 1);
    
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    
    return pages;
  }

  /**
   * Load filter options from available data
   */
  loadFilterOptions(): void {
    this.megaGoalService.getPlayers(1, 1000, '', '', '').subscribe({
      next: (response: any) => {
        const players = response.players || [];
        
        // Extract unique positions
        const positions = new Set<string>();
        const nationalities = new Set<string>();
        
        players.forEach((player: Player) => {
          if (player.player.position) {
            positions.add(player.player.position);
          }
          if (player.player.nationality) {
            nationalities.add(player.player.nationality);
          }
        });
        
        this.availablePositions = Array.from(positions).sort();
        this.availableNationalities = Array.from(nationalities).sort();
      },
      error: (error: any) => {
        console.error('Error loading filter options:', error);
      }
    });
  }

  /**
   * Clear search and reset filters
   */
  clearSearch(): void {
    this.searchText = '';
    this.selectedPosition = '';
    this.selectedNationality = '';
    this.selectedTeamsFilter = '';
    this.currentPage = 1;
    this.loadPlayers();
  }

  /**
   * Update teams for a specific player
   */
  updatePlayerTeams(player: Player): void {
    this.isUpdatingTeams[player.player.id] = true;
    
    this.updaterService.updatePlayerTeams(player.player.id).subscribe({
      next: (response: any) => {
        console.log('Teams updated for player:', player.player.id, response);
        // Reload players to get updated data
        this.loadPlayers();
        this.isUpdatingTeams[player.player.id] = false;
      },
      error: (error: any) => {
        console.error('Error updating teams for player:', player.player.id, error);
        this.isUpdatingTeams[player.player.id] = false;
      }
    });
  }

  /**
   * Handle image error by setting default image
   */
  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.src = 'assets/img/default-player.png';
    }
  }
}
