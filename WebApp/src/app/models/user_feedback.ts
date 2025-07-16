export interface UserFeedback {
    id?: string;
    username?: string;
    bug?: string;
    voted_features?: string[];
    proposal?: string;
    general?: string;
    created_at?: Date;
}