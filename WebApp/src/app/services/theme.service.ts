import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type Theme = 'blue' | 'red';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentTheme = new BehaviorSubject<Theme>('blue');
  public theme$ = this.currentTheme.asObservable();

  constructor() {
    // Load theme from localStorage on service initialization
    const savedTheme = localStorage.getItem('megagoal-theme') as Theme;
    if (savedTheme && (savedTheme === 'blue' || savedTheme === 'red')) {
      this.currentTheme.next(savedTheme);
    }
  }

  getCurrentTheme(): Theme {
    return this.currentTheme.value;
  }

  setTheme(theme: Theme): void {
    this.currentTheme.next(theme);
    localStorage.setItem('megagoal-theme', theme);
  }

  toggleTheme(): void {
    const newTheme = this.currentTheme.value === 'blue' ? 'red' : 'blue';
    this.setTheme(newTheme);
  }
}
