import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatchEvent } from '../../models/realMatch';
import { ImagesService } from '../../services/images.service';

@Component({
  selector: 'app-match-events',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './match-events.component.html',
  styleUrl: './match-events.component.css'
})
export class MatchEventsComponent {
  @Input() events!: MatchEvent[];
  @Input() homeTeamId!: number;
  @Input() awayTeamId!: number;

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
      } else if (detail.includes('penalty')) {
        return '🎯';
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
    
    // For substitutions, show player leaving → player entering
    if (type === 'subst' || detail.includes('substitution')) {
      if (event.assist && event.assist.name) {
        return `${event.player.name} → ${event.assist.name}`;
      }
      return event.player.name;
    }
    
    // For goals, show player with assist if available
    if (event.type === 'Goal' && event.assist && event.assist.name) {
      return `${event.player.name} (Assist: ${event.assist.name})`;
    }
    
    return event.player.name;
  }

  getEventDetailDisplay(event: MatchEvent): string {
    const type = event.type.toLowerCase();
    const detail = event.detail;
    
    // For substitutions, don't show detail (will be empty)
    if (type === 'subst' || detail.toLowerCase().includes('substitution')) {
      return '';
    }
    
    // For own goals, make it more prominent
    if (type === 'goal') {
      const detailLower = detail.toLowerCase();
      if (detailLower.includes('own goal')) {
        return 'OWN GOAL';
      } else if (detailLower.includes('missed penalty')) {
        return 'MISSED PENALTY';
      } else if (detailLower.includes('penalty')) {
        return 'PENALTY GOAL';
      }
    }
    
    return detail.toUpperCase();
  }

  isHomeTeam(event: MatchEvent): boolean {
    return event.team.id === this.homeTeamId;
  }

  getSortedEvents(): MatchEvent[] {
    if (!this.events || this.events.length === 0) return [];
    
    return [...this.events].sort((a, b) => {
      const timeA = this.getEventTimeInMinutes(a);
      const timeB = this.getEventTimeInMinutes(b);
      return timeA - timeB;
    });
  }

  getEventTimeInMinutes(event: MatchEvent): number {
    const baseTime = event.time.elapsed || 0;
    const extraTime = event.time.extra || 0;
    return baseTime + (extraTime / 100); // Convert extra time to fraction
  }
}
