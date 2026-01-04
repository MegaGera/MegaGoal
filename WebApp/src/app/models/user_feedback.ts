export interface UserFeedback {
    _id?: string;
    id?: string;
    username?: string;
    bug?: string;
    voted_features?: string[];
    proposal?: string;
    general?: string;
    created_at?: Date;
}