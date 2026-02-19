
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PhaseManager } from '../../src/systems/PhaseManager';
import { EventBus } from '../../src/utils/EventBus';

describe('PhaseManager', () => {
    let phaseManager: PhaseManager;

    beforeEach(() => {
        phaseManager = new PhaseManager('KICK_OFF');
        vi.clearAllMocks();
    });

    it('should initialize with KICK_OFF', () => {
        expect(phaseManager.getPhase()).toBe('KICK_OFF');
        expect(phaseManager.getPhaseCount()).toBe(0);
    });

    it('should transition from KICK_OFF to OPEN_PLAY', () => {
        expect(phaseManager.transition('OPEN_PLAY')).toBe(true);
        expect(phaseManager.getPhase()).toBe('OPEN_PLAY');
    });

    it('should fail invalid transition (KICK_OFF -> RUCK)', () => {
        const warned = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(phaseManager.transition('RUCK')).toBe(false);
        expect(phaseManager.getPhase()).toBe('KICK_OFF');
        expect(warned).toHaveBeenCalled();
    });

    it('should increment phase count on RUCK -> OPEN_PLAY', () => {
        phaseManager.forcePhase('RUCK');
        phaseManager.transition('OPEN_PLAY');
        expect(phaseManager.getPhaseCount()).toBe(1);
    });

    it('should reset phase count on SCRUM', () => {
        phaseManager.forcePhase('RUCK');
        phaseManager.transition('OPEN_PLAY'); // count = 1
        expect(phaseManager.getPhaseCount()).toBe(1);

        phaseManager.forcePhase('SCRUM'); // Force or valid transition
        // Actually SCRUM transition logic in manager resets it?
        // Let's check logic: if (['KICK_OFF', 'SCRUM', 'LINEOUT'].includes(to)) phaseCount = 0
        
        phaseManager.transition('OPEN_PLAY'); // Should allow SCRUM->OPEN_PLAY
        
        // Wait, testing "to SCRUM" reset.
        phaseManager.forcePhase('RUCK'); // Reset to RUCK
        // Ruck -> Scrum is valid? No, Ruck->Scrum (unplayable) is valid.
        
        // Let's test direct transition if valid
        // RUCK -> SCRUM is in TRANSITIONS? YES.
        
        phaseManager.forcePhase('RUCK');
        expect(phaseManager.transition('SCRUM')).toBe(true);
        expect(phaseManager.getPhaseCount()).toBe(0);
    });

    it('should emit phaseChange event', () => {
        const emitSpy = vi.spyOn(EventBus, 'emit');
        phaseManager.transition('OPEN_PLAY');
        expect(emitSpy).toHaveBeenCalledWith('phaseChange', { from: 'KICK_OFF', to: 'OPEN_PLAY' });
    });
});
