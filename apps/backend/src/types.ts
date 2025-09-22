// import z from 'zod';

// export interface Order {
//     id: string;                    // UUID
//     userId: string;                // From auth
//     asset: string;                 // e.g., "BTC-USD"
//     direction: 'LONG' | 'SHORT';   // Required
//     orderType: 'SPOT' | 'CFD';    // Required
//     qty: number;                   // Quantity to trade
    
//     // For CFD orders only
//     leverage?: number;             // Only for CFD
//     margin?: number;               // Only for CFD (USD amount)
    
//     // Optional risk management
//     stopLossPrice?: number;
//     takeProfitPrice?: number;
// }

// export const createSpotOrderSchema = z.object({
//     asset: z.string(),
//     qty: z.number(),
//     direction: z.enum(['LONG', 'SHORT']),
//     orderType: z.literal('SPOT'),
//     stopLossPrice: z.number().optional(),
//     takeProfitPrice: z.number().optional(),
// })

// export const createCfdOrderSchema = z.object({
//     asset: z.string(),
//     qty: z.number(),
//     direction: z.enum(['LONG', 'SHORT']),
//     orderType: z.literal('CFD'),
//     leverage: z.number(),
//     margin: z.number(),
//     stopLossPrice: z.number().optional(),
//     takeProfitPrice: z.number().optional(),
// })

// export const closePositionSchema = z.object({
//     orderid: z.string(),
// })