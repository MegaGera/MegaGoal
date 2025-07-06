export interface Location {
    name: string,
    id: string,
    user: {
        username: string,
    }
    private: boolean,
    stadium: boolean,
    official: boolean,
    matchCount: number
}