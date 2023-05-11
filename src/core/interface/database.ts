export interface Inventoryitems {
    id: string;
    amount: number;
    isunit: boolean;
    classid: string;
    tradable: number;
    commodity: number;
    instanceid: string;
    marketable: number;
    market_name: string;
    market_hash_name: string;
    fraudwarnings?: string;
    unitinfo?: {
        count: number;
        timestamp: number;
    },
    timestamp: number;
}