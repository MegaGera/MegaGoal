/*
    User Statistics interface for the hero section
*/
export interface UserStats {
    totalMatches: number;
    matchesBySeason: SeasonStats[];
    goalsPerMatch: number;
    favouriteTeams: TeamStats[];
    monthlyActivity: MonthlyStats[];
    favouriteLeagues: LeagueStats[];
    topGoalsTeams: TopGoalsTeamStats[];
    totalGoals: number;
    lastMatchDate: string | null;
    totalAssists?: number;
}

export interface SeasonStats {
    season: number;
    matches: number;
    goals?: number;
    assists?: number;
}

export interface MonthlyStats {
    month: string; // Format: "YYYY-MM"
    matches: number;
}

export interface TeamStats {
    id: number;
    name: string;
    matches: number;
}

export interface TopGoalsTeamStats {
    id: number;
    name: string;
    goals: number;
}

export interface LeagueStats {
    id: number;
    name: string;
    matches: number;
} 