import { AfterViewInit, Component, ElementRef, Input, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserStats } from '../../../models/userStats';
import { QuickStatCardComponent } from './quick-stat-card/quick-stat-card.component';

interface StatCard {
  value: number | string;
  label: string;
  subtitle?: string;
  teamId?: number;
  leagueId?: number;
  icon?: string;
}

@Component({
  selector: 'app-quick-stats',
  standalone: true,
  imports: [CommonModule, QuickStatCardComponent],
  templateUrl: './quick-stats.component.html',
  styleUrl: './quick-stats.component.css'
})
export class QuickStatsComponent implements OnInit, OnDestroy, AfterViewInit {
  @ViewChild('carousel', { static: false }) carouselRef?: ElementRef<HTMLDivElement>;

  private _userStats: UserStats | null = null;
  @Input() set userStats(value: UserStats | null) {
    this._userStats = value;
    this.generateStatCards();
    // Reinitialize carousel after stats change
    setTimeout(() => {
      this.initCarousel();
    }, 100);
  }
  get userStats(): UserStats | null {
    return this._userStats;
  }
  
  @Input() userStatsLoaded: boolean = false;
  @Input() containerWidth: string | null = '300px';
  @Input() showFadeEdges: boolean = false;

  statCards: StatCard[] = [];
  private scrollContainer: HTMLElement | null = null;
  private isScrolling = false;
  private scrollSpeed = 1; // pixels per frame
  private animationFrameId: number | null = null;
  
  // Mouse drag properties
  private isDragging = false;
  private startX = 0;
  private scrollLeft = 0;
  private boundContainer: HTMLElement | null = null;

  private readonly mouseDownHandler = (event: MouseEvent) => this.onMouseDown(event);
  private readonly mouseMoveHandler = (event: MouseEvent) => this.onMouseMove(event);
  private readonly mouseUpHandler = () => this.onMouseUp();
  private readonly touchStartHandler = (event: TouchEvent) => this.onTouchStart(event);
  private readonly touchMoveHandler = (event: TouchEvent) => this.onTouchMove(event);
  private readonly touchEndHandler = () => this.onTouchEnd();

  ngOnInit() {
    this.generateStatCards();
  }

  ngAfterViewInit() {
    this.initCarousel();
  }

  ngOnDestroy() {
    this.stopAutoScroll();
    this.teardownDragEvents();
  }

  private generateStatCards() {
    if (!this.userStats) {
      this.statCards = [
        { value: 0, label: 'Matches' },
        { value: 0, label: 'Top Team' },
        { value: 0, label: 'Goals' },
        { value: 0, label: 'Avg Goals' },
        { value: 0, label: 'Seasons' },
        { value: 0, label: 'Leagues' }
      ];
      return;
    }

    // Generate base stats
    const baseStats: StatCard[] = [
      { 
        value: this.userStats.totalMatches, 
        label: 'Matches',
        subtitle: "All time"
      },
      { 
        value: this.userStats.totalGoals, 
        label: 'Goals',
        subtitle: "All time"
      },
      { 
        value: this.userStats.goalsPerMatch, 
        label: 'Avg Goals',
        subtitle: "All time"
      }
    ];

    if (this.userStats.totalAssists && this.userStats.totalAssists > 0) {
      baseStats.push({
        value: this.userStats.totalAssists,
        label: 'Assists',
        subtitle: 'All time'
      });
    }

    // Generate season stats for all available seasons
    const seasonStats = this.generateSeasonStats();

    // Generate monthly activity stats for all available months
    const monthlyStats = this.generateMonthlyStats();

    // Generate team stats for all favourite teams
    const teamStats = this.generateTeamStats();

    // Generate league stats for all favourite leagues
    const leagueStats = this.generateLeagueStats();

    // Generate top goals teams stats
    const topGoalsTeamStats = this.generateTopGoalsTeamStats();

    // Combine base stats with team and league stats
    this.statCards = this.shuffleArray([...baseStats, ...seasonStats, ...monthlyStats, ...teamStats, ...leagueStats, ...topGoalsTeamStats]);
  }

  /**
   * Auto-generates stat cards for all teams in favouriteTeams
   * @returns Array of StatCard objects for each team
   */
  private generateTeamStats(): StatCard[] {
    if (!this.userStats?.favouriteTeams || this.userStats.favouriteTeams.length === 0) {
      return [];
    }

    return this.userStats.favouriteTeams.map((team, index) => {
      const position = index + 1;
      const positionText = position === 1 ? 'Top Matches' :
                          `${position}º Matches`;

      return {
        value: team.matches,
        label: positionText,
        subtitle: team.name,
        teamId: team.id
      };
    });
  }

  /**
   * Auto-generates stat cards for all leagues in favouriteLeagues
   * @returns Array of StatCard objects for each league
   */
  private generateLeagueStats(): StatCard[] {
    if (!this.userStats?.favouriteLeagues || this.userStats.favouriteLeagues.length === 0) {
      return [];
    }

    return this.userStats.favouriteLeagues.map((league, index) => {
      const position = index + 1;
      const positionText = position === 1 ? 'Top League' :
                          `${position}º League`;

      return {
        value: league.matches,
        label: positionText,
        subtitle: league.name,
        leagueId: league.id
      };
    });
  }

  /**
   * Auto-generates stat cards for all teams in topGoalsTeams
   * @returns Array of StatCard objects for each team
   */
  private generateTopGoalsTeamStats(): StatCard[] {
    if (!this.userStats?.topGoalsTeams || this.userStats.topGoalsTeams.length === 0) {
      return [];
    }

    return this.userStats.topGoalsTeams.map((team, index) => {
      const position = index + 1;
      const positionText = position === 1 ? 'Top Goals' :
                          `${position}º Goals`;

      return {
        value: team.goals,
        label: positionText,
        subtitle: team.name,
        teamId: team.id
      };
    });
  }

  /**
   * Auto-generates stat cards for all seasons in matchesBySeason
   * @returns Array of StatCard objects for each season
   */
  private generateSeasonStats(): StatCard[] {
    if (!this.userStats?.matchesBySeason || this.userStats.matchesBySeason.length === 0) {
      return [];
    }

    return this.userStats.matchesBySeason.flatMap((season) => {
      const seasonLabel = `${season.season} - ${season.season + 1}`;

      const cards: StatCard[] = [];

      if (season.matches > 0) {
        cards.push({
          value: season.matches,
          label: "Matches",
          subtitle: seasonLabel
        });
      }

      if (season.goals && season.goals > 0) {
        cards.push({
          value: season.goals,
          label: "Goals",
          subtitle: seasonLabel
        });
      }

      if (season.assists && season.assists > 0) {
        cards.push({
          value: season.assists,
          label: "Assists",
          subtitle: seasonLabel
        });
      }

      return cards;
    });
  }

  /**
   * Auto-generates stat cards for all months in monthlyActivity
   * @returns Array of StatCard objects for each month
   */
  private generateMonthlyStats(): StatCard[] {
    if (!this.userStats?.monthlyActivity || this.userStats.monthlyActivity.length === 0) {
      return [];
    }

    return this.userStats.monthlyActivity.map((month) => {
      // Parse the month string (format: "YYYY-MM")
      const [year, monthNum] = month.month.split('-');
      const date = new Date(parseInt(year), parseInt(monthNum) - 1);
      const monthName = date.toLocaleDateString('en-US', { month: 'long' });
      const monthLabel = `${monthName.substring(0, 3)} - ${year}`;
      
      return {
        value: month.matches,
        label: "Matches",
        subtitle: monthLabel
      };
    });
  }

  /**
   * Shuffles an array using the Fisher-Yates algorithm
   * @param array The array to shuffle
   * @returns The shuffled array
   */
  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array]; // Create a copy to avoid modifying the original
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private initCarousel() {
    this.stopAutoScroll();
    this.scrollContainer = this.carouselRef?.nativeElement || null;

    if (!this.scrollContainer || this.statCards.length <= 2) {
      this.stopAutoScroll();
      this.teardownDragEvents();
      this.boundContainer = null;
      return;
    }

    if (this.boundContainer !== this.scrollContainer) {
      this.teardownDragEvents();
      this.setupDragEvents(this.scrollContainer);
      this.boundContainer = this.scrollContainer;
    }

    if (this.scrollContainer) {
      this.scrollContainer.style.cursor = 'grab';
    }

    this.startAutoScroll();
  }

  private setupDragEvents(container: HTMLElement) {
    // Mouse events for desktop
    container.addEventListener('mousedown', this.mouseDownHandler);
    container.addEventListener('mousemove', this.mouseMoveHandler);
    container.addEventListener('mouseup', this.mouseUpHandler);
    container.addEventListener('mouseleave', this.mouseUpHandler);

    // Touch events for mobile
    container.addEventListener('touchstart', this.touchStartHandler, { passive: false });
    container.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
    container.addEventListener('touchend', this.touchEndHandler);
  }

  private teardownDragEvents() {
    if (!this.boundContainer) {
      this.stopAutoScroll();
      return;
    }
    this.boundContainer.removeEventListener('mousedown', this.mouseDownHandler);
    this.boundContainer.removeEventListener('mousemove', this.mouseMoveHandler);
    this.boundContainer.removeEventListener('mouseup', this.mouseUpHandler);
    this.boundContainer.removeEventListener('mouseleave', this.mouseUpHandler);
    this.boundContainer.removeEventListener('touchstart', this.touchStartHandler);
    this.boundContainer.removeEventListener('touchmove', this.touchMoveHandler);
    this.boundContainer.removeEventListener('touchend', this.touchEndHandler);
    this.boundContainer.style.cursor = '';
    this.boundContainer.style.userSelect = '';
    this.boundContainer = null;
  }

  private onMouseDown(e: MouseEvent) {
    this.isDragging = true;
    this.startX = e.pageX - (this.scrollContainer?.offsetLeft || 0);
    this.scrollLeft = this.scrollContainer?.scrollLeft || 0;
    
    // Pause auto-scroll during drag
    this.stopAutoScroll();
    
    // Change cursor
    if (this.scrollContainer) {
      this.scrollContainer.style.cursor = 'grabbing';
      this.scrollContainer.style.userSelect = 'none';
    }
  }

  private onMouseMove(e: MouseEvent) {
    if (!this.isDragging || !this.scrollContainer) return;
    
    e.preventDefault();
    const x = e.pageX - (this.scrollContainer.offsetLeft || 0);
    const walk = (x - this.startX) * 2; // Scroll speed multiplier
    this.scrollContainer.scrollLeft = this.scrollLeft - walk;
  }

  private onMouseUp() {
    this.isDragging = false;
    
    // Resume auto-scroll
    this.startAutoScroll();
    
    // Reset cursor
    if (this.scrollContainer) {
      this.scrollContainer.style.cursor = 'grab';
      this.scrollContainer.style.userSelect = 'auto';
    }
  }

  private onTouchStart(e: TouchEvent) {
    this.isDragging = true;
    this.startX = e.touches[0].pageX - (this.scrollContainer?.offsetLeft || 0);
    this.scrollLeft = this.scrollContainer?.scrollLeft || 0;
    
    // Pause auto-scroll during touch
    this.stopAutoScroll();
  }

  private onTouchMove(e: TouchEvent) {
    if (!this.isDragging || !this.scrollContainer) return;
    
    e.preventDefault();
    const x = e.touches[0].pageX - (this.scrollContainer.offsetLeft || 0);
    const walk = (x - this.startX) * 2;
    this.scrollContainer.scrollLeft = this.scrollLeft - walk;
  }

  private onTouchEnd() {
    this.isDragging = false;
    
    // Resume auto-scroll
    this.startAutoScroll();
  }

  private startAutoScroll() {
    if (this.isScrolling || this.isDragging) return;
    
    this.isScrolling = true;
    
    const animate = () => {
      if (this.scrollContainer && this.isScrolling && !this.isDragging) {
        this.scrollContainer.scrollLeft += this.scrollSpeed;
        
        // Check if we need to reset to create infinite loop
        const scrollWidth = this.scrollContainer.scrollWidth;
        const currentScrollLeft = this.scrollContainer.scrollLeft;
        
        // When we've scrolled past the first set of cards, reset to beginning
        // This creates the illusion of infinite scrolling
        if (currentScrollLeft >= scrollWidth / 2) {
          this.scrollContainer.scrollLeft = 0;
        }
        
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private stopAutoScroll() {
    this.isScrolling = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  onMouseEnter() {
    this.stopAutoScroll();
  }

  onMouseLeave() {
    if (!this.isDragging) {
      this.startAutoScroll();
    }
  }

  trackByIndex(index: number): number {
    return index;
  }

  getCarouselStyles(): { [key: string]: string } {
    if (!this.containerWidth) {
      return {};
    }
    return { width: this.containerWidth };
  }
} 