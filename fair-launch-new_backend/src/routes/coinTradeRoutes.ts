import express from 'express';
import CoinStatus from '../models/CoinsStatus';
import Joi from 'joi';
const idSchema = Joi.string().required();

const router = express.Router();

router.get('/:id', async (req, res) => {
    const { error } = idSchema.validate(req.params.id);
    if (error) return res.status(400).send("Invalid ID format");

    const coinId = req.params.id;
    try {
        const coinTrade = await CoinStatus.findOne({ coinId }).populate('coinId').populate('record.holder')
        res.status(200).send(coinTrade);
    } catch (error) {
        res.status(500).send(error);
    }
});


export default router;
