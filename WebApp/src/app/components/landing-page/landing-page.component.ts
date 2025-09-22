import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIconComponent, provideIcons, provideNgIconsConfig } from '@ng-icons/core';
import { 
  jamArrowRight, 
  jamArrowDown, 
  jamTrophy, 
  jamEye, 
  jamUsers, 
  jamStar, 
  jamCheck, 
  jamPlay,
  jamGithub,
  jamTwitter,
  jamLinkedin,
  jamSun,
  jamMoon
} from '@ng-icons/jam-icons';
import { ionFootball, ionTrophy, ionStatsChart, ionLocation, ionEye, ionPeople } from '@ng-icons/ionicons';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { FavouriteTeamCardComponent } from '../stats/favourite-team-card/favourite-team-card.component';
import { LandingService, LandingPageInfo } from '../../services/landing.service';
import { Match } from '../../models/match';
import { FavouriteTeamStats } from '../../models/favouriteTeamStats';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';
import { ThemeService, Theme } from '../../services/theme.service';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIconComponent, RealMatchCardComponent, FavouriteTeamCardComponent],
  templateUrl: './landing-page.component.html',
  styleUrl: './landing-page.component.css',
  providers: [provideNgIconsConfig({
    size: '1.5rem',
  }), provideIcons({ 
    jamArrowRight, 
    jamArrowDown, 
    jamTrophy, 
    jamEye, 
    jamUsers, 
    jamStar, 
    jamCheck, 
    jamPlay,
    jamGithub,
    jamTwitter,
    jamLinkedin,
    jamSun,
    jamMoon,
    ionFootball,
    ionTrophy,
    ionStatsChart,
    ionLocation,
    ionEye,
    ionPeople
  }), LandingService, ImagesService, StatsService, ThemeService]
})
export class LandingPageComponent implements OnInit {
  
  // Match data for landing page
  demoMatches: Match[] = [];
  matchLoaded: boolean = false;
  matchError: boolean = false;
  
  // Team stats data for landing page
  teamStats: FavouriteTeamStats | null = null;
  teamStatsLoaded: boolean = false;
  teamStatsError: boolean = false;
  
  // Theme management
  currentTheme: Theme = 'blue';
  
  features = [
    {
      icon: 'ionFootball',
      title: 'Match Tracking',
      description: 'Track every football match you watch with detailed statistics and location data.',
      color: '#4CAF50'
    },
    {
      icon: 'ionStatsChart',
      title: 'Advanced Analytics',
      description: 'Get comprehensive insights into your viewing habits and favorite teams.',
      color: '#2196F3'
    },
    {
      icon: 'ionLocation',
      title: 'Location Tracking',
      description: 'Remember where you watched each match and discover viewing patterns.',
      color: '#FF9800'
    },
    {
      icon: 'ionTrophy',
      title: 'League Management',
      description: 'Follow multiple leagues and competitions with personalized statistics.',
      color: '#9C27B0'
    },
    {
      icon: 'ionEye',
      title: 'Visual Experience',
      description: 'Beautiful, modern interface designed for the ultimate football fan experience.',
      color: '#F44336'
    },
    {
      icon: 'ionPeople',
      title: 'Community Features',
      description: 'Share your passion with other football enthusiasts and compare stats.',
      color: '#00BCD4'
    }
  ];

  stats = [
    { number: '10K+', label: 'Matches Tracked' },
    { number: '500+', label: 'Active Users' },
    { number: '50+', label: 'Leagues Supported' },
    { number: '99%', label: 'User Satisfaction' }
  ];

  testimonials = [
    {
      name: 'Alex Rodriguez',
      role: 'Football Enthusiast',
      content: 'MegaGoal has completely transformed how I track my football viewing. The analytics are incredible!',
      avatar: 'AR'
    },
    {
      name: 'Sarah Johnson',
      role: 'Sports Blogger',
      content: 'The location tracking feature is brilliant. I can see exactly where I watched each match.',
      avatar: 'SJ'
    },
    {
      name: 'Mike Chen',
      role: 'Data Analyst',
      content: 'Finally, a platform that gives me the detailed statistics I need for my football analysis.',
      avatar: 'MC'
    }
  ];

  constructor(
    private landingService: LandingService,
    private statsService: StatsService,
    public images: ImagesService,
    private themeService: ThemeService
  ) { }

  ngOnInit(): void {
    this.loadLandingPageInfo();
    this.loadTeamStats();
    this.subscribeToTheme();
  }

  subscribeToTheme(): void {
    this.themeService.theme$.subscribe(theme => {
      this.currentTheme = theme;
    });
  }

  loadLandingPageInfo(): void {
    this.matchLoaded = false;
    this.matchError = false;
    
    this.landingService.getLandingPageInfo().subscribe({
      next: (data: LandingPageInfo) => {
        this.demoMatches = data.matches;
        this.matchLoaded = true;
        this.matchError = false;
      },
      error: (error) => {
        console.error('Error loading landing page info:', error);
        this.matchError = true;
        this.matchLoaded = true;
      }
    });
  }

  loadTeamStats(): void {
    this.teamStatsLoaded = false;
    this.teamStatsError = false;
    
    this.statsService.getLandingPageTeamStats().subscribe({
      next: (data: FavouriteTeamStats) => {
        this.teamStats = data;
        this.teamStatsLoaded = true;
        this.teamStatsError = false;
      },
      error: (error) => {
        console.error('Error loading team stats:', error);
        this.teamStatsError = true;
        this.teamStatsLoaded = true;
      }
    });
  }

  scrollToSection(sectionId: string): void {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  }

  goToApp(): void {
    // Navigate to the main app
    window.location.href = '/app';
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }
}
