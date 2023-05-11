import crypto from "crypto";

export const createHash = (data: string) => {
    return crypto.createHash('sha1').update(data).digest('hex');
}