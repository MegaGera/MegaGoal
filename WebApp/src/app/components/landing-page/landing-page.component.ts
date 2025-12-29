import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { Meta, Title } from '@angular/platform-browser';
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
  jamLinkedin
} from '@ng-icons/jam-icons';
import { ionFootball, ionTrophy, ionStatsChart, ionLocation, ionEye, ionPeople } from '@ng-icons/ionicons';
import { RealMatchCardComponent } from '../real-match-card/real-match-card.component';
import { FavouriteTeamCardComponent } from '../stats/favourite-team-card/favourite-team-card.component';
import { LandingService, LandingPageInfo } from '../../services/landing.service';
import { Match } from '../../models/match';
import { FavouriteTeamStats } from '../../models/favouriteTeamStats';
import { ImagesService } from '../../services/images.service';
import { StatsService } from '../../services/stats.service';

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
    ionFootball,
    ionTrophy,
    ionStatsChart,
    ionLocation,
    ionEye,
    ionPeople
  }), LandingService, ImagesService, StatsService]
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
  
  
  features = [
    {
      icon: 'ionFootball',
      title: 'Match Tracking',
      description: 'Track every football match you watch with detailed statistics and location data',
      color: '#4CAF50'
    },
    {
      icon: 'ionStatsChart',
      title: 'Advanced Analytics',
      description: 'Get stats into your viewing habits and favorite teams',
      color: '#2196F3'
    },
    {
      icon: 'ionLocation',
      title: 'Location Tracking',
      description: 'Remember where you watched each match',
      color: '#FF9800'
    },
    {
      icon: 'ionTrophy',
      title: 'League Management',
      description: 'Follow multiple leagues and competitions with personalized statistics',
      color: '#9C27B0'
    },
  ];

  stats = [
    { number: '70K+', label: 'Matches' },
    { number: '6k+', label: 'Teams' },
    { number: '50k+', label: 'Players' }
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
    private meta: Meta,
    private title: Title
  ) { }

  ngOnInit(): void {
    this.setMetaTags();
    this.loadLandingPageInfo();
    this.loadTeamStats();
    
    // Log page visit (public endpoint, no authentication required)
    this.landingService.logPageVisit('landing-page').subscribe({
      next: () => {},
      error: (error) => console.error('Error logging page visit:', error)
    });
  }

  setMetaTags(): void {
    // Set page title
    this.title.setTitle('MegaGoal - Track Every Football Match You Watch | Football Analytics Platform');
    
    // Set meta description
    this.meta.updateTag({ 
      name: 'description', 
      content: 'MegaGoal is the ultimate platform for football fans to track matches, analyze statistics, and discover viewing patterns. Join thousands of passionate fans who never miss a detail.' 
    });
    
    // Set keywords
    this.meta.updateTag({ 
      name: 'keywords', 
      content: 'football analytics, match tracking, sports statistics, football fans, match analysis, football data, sports analytics, football platform, megagoal, mega, goal, megagera' 
    });
    
    // Set Open Graph tags
    this.meta.updateTag({ property: 'og:title', content: 'MegaGoal - Track Every Football Match You Watch' });
    this.meta.updateTag({ property: 'og:description', content: 'MegaGoal is the ultimate platform for football fans to track matches, analyze statistics, and discover viewing patterns.' });
    this.meta.updateTag({ property: 'og:type', content: 'website' });
    this.meta.updateTag({ property: 'og:url', content: 'https://megagoal.com/' });
    this.meta.updateTag({ property: 'og:image', content: 'https://server.megamedia.megagera.com/megagera/MG_logo.png' });
    
    // Set Twitter Card tags
    this.meta.updateTag({ property: 'twitter:card', content: 'summary_large_image' });
    this.meta.updateTag({ property: 'twitter:title', content: 'MegaGoal - Track Every Football Match You Watch' });
    this.meta.updateTag({ property: 'twitter:description', content: 'MegaGoal is the ultimate platform for football fans to track matches, analyze statistics, and discover viewing patterns.' });
    this.meta.updateTag({ property: 'twitter:image', content: 'https://server.megamedia.megagera.com/megagera/MG_logo.png' });
    
    // Add JSON-LD structured data for SEO
    this.addStructuredData();
  }

  private addStructuredData(): void {
    const structuredData = {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      "name": "MegaGoal",
      "alternateName": "MegaGoal Football Analytics Platform",
      "description": "MegaGoal is the ultimate platform for football fans to track matches, analyze statistics, and discover viewing patterns",
      "url": "https://megagoal.com",
      "applicationCategory": "SportsApplication",
      "operatingSystem": "Web Browser",
      "offers": {
        "@type": "Offer",
        "price": "0",
        "priceCurrency": "USD"
      },
      "logo": "https://server.megamedia.megagera.com/megagera/MG_logo.png",
      "screenshot": "https://server.megamedia.megagera.com/megagera/MG_logo.png",
      "featureList": [
        "Match Tracking",
        "Advanced Analytics", 
        "Location Tracking",
        "League Management"
      ],
      "keywords": "football analytics, match tracking, sports statistics, football fans, match analysis, football data, sports analytics, football platform, megagoal, mega, goal, megagera"
    };

    // Remove existing structured data if any
    const existingScript = document.querySelector('script[type="application/ld+json"]');
    if (existingScript) {
      existingScript.remove();
    }

    // Add new structured data
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(structuredData);
    document.head.appendChild(script);
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

  goToLoginTestUser(): void {
    // Navigate to the main app
    // Make a POST request to the test login endpoint and redirect on success
    fetch('https://megaauth.megagera.com/login/test', {
      method: 'POST',
      credentials: 'include' // include cookies if needed
    })
    .then(response => {
      if (response.redirected) {
        window.location.href = response.url;
      } else if (response.ok) {
        // Assume API provides URL in response or just reload
        window.location.href = '/app';
      } else {
        alert('Test user login failed.');
      }
    })
    .catch(() => {
      alert('Error during test user login.');
    });
  }

}
