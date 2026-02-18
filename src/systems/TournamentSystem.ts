/**
 * TournamentSystem — tournament bracket and season mode.
 *
 * Manages bracket progression, win/loss tracking, and league points.
 * Uses localStorage for save/load.
 */

export interface TournamentTeam {
  name: string;
  color: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  bonusPoints: number;
}

export interface TournamentMatch {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  played: boolean;
  round: number;
}

export class TournamentSystem {
  private teams: TournamentTeam[] = [];
  private matches: TournamentMatch[] = [];
  private currentRound = 0;
  private format: 'knockout' | 'league' = 'knockout';

  /**
   * Initialize a knockout tournament.
   */
  initKnockout(teamNames: { name: string; color: number }[]): void {
    this.format = 'knockout';
    this.teams = teamNames.map(t => ({
      ...t, wins: 0, losses: 0, draws: 0,
      pointsFor: 0, pointsAgainst: 0, bonusPoints: 0,
    }));
    this.matches = [];
    this.currentRound = 1;

    // Create first round matches
    for (let i = 0; i < this.teams.length; i += 2) {
      if (i + 1 < this.teams.length) {
        this.matches.push({
          home: this.teams[i].name,
          away: this.teams[i + 1].name,
          homeScore: 0, awayScore: 0,
          played: false, round: 1,
        });
      }
    }
  }

  /**
   * Initialize a league tournament.
   */
  initLeague(teamNames: { name: string; color: number }[]): void {
    this.format = 'league';
    this.teams = teamNames.map(t => ({
      ...t, wins: 0, losses: 0, draws: 0,
      pointsFor: 0, pointsAgainst: 0, bonusPoints: 0,
    }));
    this.matches = [];
    this.currentRound = 1;

    // Round-robin: each team plays every other
    let round = 1;
    for (let i = 0; i < this.teams.length; i++) {
      for (let j = i + 1; j < this.teams.length; j++) {
        this.matches.push({
          home: this.teams[i].name,
          away: this.teams[j].name,
          homeScore: 0, awayScore: 0,
          played: false, round: round++,
        });
      }
    }
  }

  /**
   * Record a match result.
   */
  recordResult(homeTeam: string, awayTeam: string, homeScore: number, awayScore: number): void {
    const match = this.matches.find(
      m => m.home === homeTeam && m.away === awayTeam && !m.played
    );
    if (!match) return;

    match.homeScore = homeScore;
    match.awayScore = awayScore;
    match.played = true;

    const home = this.teams.find(t => t.name === homeTeam);
    const away = this.teams.find(t => t.name === awayTeam);
    if (!home || !away) return;

    home.pointsFor += homeScore;
    home.pointsAgainst += awayScore;
    away.pointsFor += awayScore;
    away.pointsAgainst += homeScore;

    if (homeScore > awayScore) {
      home.wins++;
      away.losses++;
      // 4-try bonus point (simplified: if scored 4+ tries ≈ 20+ points)
      if (homeScore >= 20) home.bonusPoints++;
      // Losing bonus (within 7 points)
      if (awayScore >= homeScore - 7) away.bonusPoints++;
    } else if (awayScore > homeScore) {
      away.wins++;
      home.losses++;
      if (awayScore >= 20) away.bonusPoints++;
      if (homeScore >= awayScore - 7) home.bonusPoints++;
    } else {
      home.draws++;
      away.draws++;
    }

    // Advance knockout if all matches in current round are played
    if (this.format === 'knockout') {
      this.checkKnockoutAdvance();
    }
  }

  private checkKnockoutAdvance(): void {
    const currentMatches = this.matches.filter(m => m.round === this.currentRound);
    if (currentMatches.every(m => m.played)) {
      // Create next round matches
      const winners = currentMatches.map(m =>
        m.homeScore >= m.awayScore ? m.home : m.away
      );

      if (winners.length <= 1) return; // Tournament over

      this.currentRound++;
      for (let i = 0; i < winners.length; i += 2) {
        if (i + 1 < winners.length) {
          this.matches.push({
            home: winners[i], away: winners[i + 1],
            homeScore: 0, awayScore: 0,
            played: false, round: this.currentRound,
          });
        }
      }
    }
  }

  /** Get league table sorted by points */
  getLeagueTable(): TournamentTeam[] {
    return [...this.teams].sort((a, b) => {
      const aPoints = a.wins * 4 + a.draws * 2 + a.bonusPoints;
      const bPoints = b.wins * 4 + b.draws * 2 + b.bonusPoints;
      if (bPoints !== aPoints) return bPoints - aPoints;
      return (b.pointsFor - b.pointsAgainst) - (a.pointsFor - a.pointsAgainst);
    });
  }

  /** Get next unplayed match */
  getNextMatch(): TournamentMatch | null {
    return this.matches.find(m => !m.played) ?? null;
  }

  /** Get tournament winner (knockout only) */
  getWinner(): string | null {
    if (this.format === 'knockout') {
      const finalMatch = this.matches.filter(m => m.played).pop();
      if (finalMatch) return finalMatch.homeScore >= finalMatch.awayScore ? finalMatch.home : finalMatch.away;
    }
    return null;
  }

  isTournamentComplete(): boolean {
    return this.matches.every(m => m.played);
  }

  /** Save to localStorage */
  save(): void {
    localStorage.setItem('rugby_tournament', JSON.stringify({
      teams: this.teams, matches: this.matches,
      currentRound: this.currentRound, format: this.format,
    }));
  }

  /** Load from localStorage */
  load(): boolean {
    const data = localStorage.getItem('rugby_tournament');
    if (!data) return false;
    const parsed = JSON.parse(data);
    this.teams = parsed.teams;
    this.matches = parsed.matches;
    this.currentRound = parsed.currentRound;
    this.format = parsed.format;
    return true;
  }

  clear(): void {
    localStorage.removeItem('rugby_tournament');
  }
}
