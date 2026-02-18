/**
 * TeamEditor — custom team/player editor.
 *
 * Allows creating custom teams with names, colors, and player stats.
 * Saves/loads via localStorage.
 */

export interface CustomPlayer {
  name: string;
  position: number; // 1–15
  stats: {
    speed: number;
    strength: number;
    handling: number;
    kicking: number;
    stamina: number;
    tackling: number;
    awareness: number;
    workRate: number;
  };
}

export interface CustomTeam {
  id: string;
  name: string;
  color: number;
  players: CustomPlayer[];
}

const STORAGE_KEY = 'rugby_custom_teams';

export class TeamEditor {
  private teams: CustomTeam[] = [];

  constructor() {
    this.load();
  }

  /** Create a new custom team with default players */
  createTeam(name: string, color: number): CustomTeam {
    const positionNames = [
      'Loosehead Prop', 'Hooker', 'Tighthead Prop',
      'Lock 4', 'Lock 5', 'Blindside Flanker', 'Openside Flanker', 'Number 8',
      'Scrum Half', 'Fly Half', 'Left Wing', 'Inside Centre', 'Outside Centre',
      'Right Wing', 'Fullback',
    ];

    const team: CustomTeam = {
      id: `custom_${Date.now()}`,
      name,
      color,
      players: positionNames.map((pName, i) => ({
        name: pName,
        position: i + 1,
        stats: { speed: 70, strength: 70, handling: 70, kicking: 60, stamina: 75, tackling: 70, awareness: 70, workRate: 70 },
      })),
    };

    this.teams.push(team);
    this.save();
    return team;
  }

  /** Update a player's stats */
  updatePlayerStats(teamId: string, position: number, stats: Partial<CustomPlayer['stats']>): void {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;
    const player = team.players.find(p => p.position === position);
    if (!player) return;
    Object.assign(player.stats, stats);
    this.save();
  }

  /** Update a player's name */
  updatePlayerName(teamId: string, position: number, name: string): void {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;
    const player = team.players.find(p => p.position === position);
    if (player) {
      player.name = name;
      this.save();
    }
  }

  /** Update team name and color */
  updateTeam(teamId: string, name?: string, color?: number): void {
    const team = this.teams.find(t => t.id === teamId);
    if (!team) return;
    if (name !== undefined) team.name = name;
    if (color !== undefined) team.color = color;
    this.save();
  }

  /** Delete a custom team */
  deleteTeam(teamId: string): void {
    this.teams = this.teams.filter(t => t.id !== teamId);
    this.save();
  }

  /** Get all custom teams */
  getTeams(): ReadonlyArray<CustomTeam> {
    return this.teams;
  }

  /** Get a specific team */
  getTeam(teamId: string): CustomTeam | undefined {
    return this.teams.find(t => t.id === teamId);
  }

  private save(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.teams));
  }

  private load(): void {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      this.teams = JSON.parse(data);
    }
  }
}
