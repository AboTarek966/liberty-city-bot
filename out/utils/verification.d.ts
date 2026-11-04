import { Guild, GuildMember } from 'discord.js';
export declare function getAccountAgeDays(user: {
    createdTimestamp: number;
}): number;
export declare function cleanupVerificationState(): void;
export interface ChallengeResult {
    ok: boolean;
    blocked?: boolean;
    blockedMinutes?: number;
    question?: string;
    expiresInMinutes?: number;
}
export declare function createVerificationChallenge(userId: string): ChallengeResult;
export interface AnswerResult {
    status: 'ok' | 'wrong' | 'expired' | 'blocked';
    attemptsLeft?: number;
    blockedMinutes?: number;
}
export declare function consumeVerificationChallenge(userId: string, rawAnswer: string): AnswerResult;
export interface GrantResult {
    ok: boolean;
    message: string;
}
export declare function grantVerifiedRole(guild: Guild, member: GuildMember, verification: {
    roleId?: string;
    quarantineRoleId?: string;
}, reason?: string): Promise<GrantResult>;
export type VerificationLogAction = 'success' | 'fail' | 'blocked' | 'info';
export declare function logVerification(guild: Guild, member: GuildMember, action: VerificationLogAction, details: string): Promise<void>;
//# sourceMappingURL=verification.d.ts.map