import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatchEvent } from '../../models/realMatch';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-match-events',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './match-events.component.html',
  styleUrl: './match-events.component.css'
})
export class MatchEventsComponent {
  @Input() events!: MatchEvent[];
  @Input() homeTeamId!: number;
  @Input() awayTeamId!: number;

  showAllEvents: boolean = false;

  constructor(public images: ImagesService) {}

  getEventIcon(event: MatchEvent): string {
    const type = event.type.toLowerCase();
    const detail = event.detail.toLowerCase();
    
    // Goal types
    if (type === 'goal') {
      if (detail.includes('own goal')) {
        return '🔴';
      } else if (detail.includes('missed penalty')) {
        return '❌';
      }
      return '⚽'; // Normal Goal
    }
    
    // Card events
    if (detail.includes('yellow card')) {
      return '🟨';
    } else if (detail.includes('red card')) {
      return '🟥';
    }
    
    // Substitution
    if (type === 'subst' || detail.includes('substitution')) {
      return '🔄';
    }
    
    // VAR
    if (detail.includes('var')) {
      return '📺';
    }
    
    // Other common events
    if (detail.includes('injury')) {
      return '🏥';
    } else if (detail.includes('offside')) {
      return '🚩';
    } else if (detail.includes('foul')) {
      return '⚠️';
    }
    
    return '⚪';
  }

  getEventClass(event: MatchEvent): string {
    const isHomeTeam = event.team.id === this.homeTeamId;
    let className = isHomeTeam ? 'event-home' : 'event-away';
    
    const type = event.type.toLowerCase();
    const detail = event.detail.toLowerCase();
    
    // Add class for goals to make them bigger
    if (type === 'goal') {
      className += ' event-goal';
    }
    
    // Add special class for own goal
    if (type === 'goal' && detail.includes('own goal')) {
      className += ' event-own-goal';
    } else if (type === 'goal' && detail.includes('missed penalty')) {
      className += ' event-missed-penalty';
    } else if (type === 'subst' || detail.includes('substitution')) {
      className += ' event-substitution';
    }
    
    return className;
  }

  formatTime(event: MatchEvent): string {
    if (event.time.extra) {
      return `${event.time.elapsed}+${event.time.extra}'`;
    }
    return `${event.time.elapsed}'`;
  }

  getEventDescription(event: MatchEvent): string {
    const type = event.type.toLowerCase();
    const detail = event.detail.toLowerCase();
    
    if ((type === 'subst' || detail.toLowerCase().includes('substitution')) && event.assist && event.assist.name) {
      return event.assist.name;
    }

    return event.player.name;
  }

  getEventPlayerId(event: MatchEvent): number {
    const type = event.type.toLowerCase();
    const detail = event.detail.toLowerCase();
    
    // For substitutions, use assist.id (player coming in) if available
    if ((type === 'subst' || detail.includes('substitution')) && event.assist?.id) {
      return event.assist.id;
    }
    
    // Otherwise, use the main player id
    return event.player.id;
  }

  getEventDetailDisplay(event: MatchEvent): string {
    const type = event.type.toLowerCase();
    const detail = event.detail;
    
    if (type === 'subst' || detail.includes('substitution')) {
      return event.player.name;
    }
    
    // For own goals, make it more prominent
    if (type === 'goal') {
      const detailLower = detail.toLowerCase();
      if (detailLower.includes('own goal')) {
        return 'Own goal';
      } else if (detailLower.includes('missed penalty')) {
        return 'Missed penalty';
      } else if (detailLower.includes('penalty')) {
        return 'Penalty goal';
      }
    }

    // For goals, show player with assist if available
    if (event.assist && event.assist.name) {
      // console.log("assist");
      // console.log(event.assist.name);
      return event.assist.name;
    }
    
    if (type === 'goal') {
      return "";
    }
    return detail;
  }

  isHomeTeam(event: MatchEvent): boolean {
    return event.team.id === this.homeTeamId;
  }

  isImportantEvent(event: MatchEvent): boolean {
    const type = event.type.toLowerCase();
    const detail = event.detail.toLowerCase();
    
    // Goals are important
    if (type === 'goal') {
      return true;
    }
    
    // Red cards are important
    if (detail.includes('red card')) {
      return true;
    }
    
    return false;
  }

  getSortedEvents(): MatchEvent[] {
    if (!this.events || this.events.length === 0) return [];
    
    let filteredEvents = [...this.events];
    
    // Filter to show only important events if toggle is off
    if (!this.showAllEvents) {
      filteredEvents = filteredEvents.filter(event => this.isImportantEvent(event));
    }
    
    return filteredEvents.sort((a, b) => {
      const timeA = this.getEventTimeInMinutes(a);
      const timeB = this.getEventTimeInMinutes(b);
      return timeA - timeB;
    });
  }

  hasNoImportantEvents(): boolean {
    if (!this.events || this.events.length === 0) return false;
    if (this.showAllEvents) return false; // Only show message when filtering important events
    
    const importantEvents = this.events.filter(event => this.isImportantEvent(event));
    return importantEvents.length === 0;
  }

  toggleEventFilter(): void {
    this.showAllEvents = !this.showAllEvents;
  }

  getEventTimeInMinutes(event: MatchEvent): number {
    const baseTime = event.time.elapsed || 0;
    const extraTime = event.time.extra || 0;
    return baseTime + (extraTime / 100); // Convert extra time to fraction
  }

  getPlayerImageUrl(playerId: number): string {
    return `https://media.api-sports.io/football/players/${playerId}.png`;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      // Prevent infinite loop by checking if we're already on a fallback
      if (target.src.includes('default-player.png') || target.src.includes('data:image')) {
        // If fallback also fails, hide the image
        target.style.display = 'none';
        return;
      }
      // Use a data URI placeholder to prevent 404 errors and infinite loops
      // This creates a simple gray placeholder image
      target.src = 'data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\'%3E%3Crect width=\'40\' height=\'40\' fill=\'%23e5e7eb\'/%3E%3C/svg%3E';
      // If even the data URI fails (shouldn't happen), hide the image
      target.onerror = () => {
        target.style.display = 'none';
      };
    }
  }
}
