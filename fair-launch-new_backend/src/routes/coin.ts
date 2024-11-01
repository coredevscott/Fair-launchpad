import express from "express";
import Joi from "joi";
import Coin from "../models/Coin";
import { auth } from "../middleware/authorization";
import { createToken, swapTx } from "../program/web3";
import { io } from "../sockets";

const idSchema = Joi.string().required();

const router = express.Router();


// @route   GET /coin/
// @desc    Get all created coins
// @access  Public
router.get('/', async (req, res) => {
    const coins = await Coin.find({}).populate({
        path: 'creator',
        select: 'name' // Only include the 'name' field from the creator schema
    });

    return res.status(200).send(coins)
})

// @route   GET /coin/user/:userID
// @desc    Get coins created by userID
// @access  Public
router.get('/user/:userID', (req, res) => {
    const { error } = idSchema.validate(req.params.userID);
    if (error) return res.status(400).send("Invalid ID format");

    const creator = req.params.userID;
    Coin.find({ creator }).populate('creator').then(coins => res.status(200).send(coins)).catch(err => res.status(400).json('Nothing'))
})

// @route   POST /coin
// @desc    Create coin
// @access  Public
router.post('/', auth, async (req, res) => {

    const { body } = req;
    const UserSchema = Joi.object().keys({
        creator: Joi.string().required(),
        name: Joi.string().required(),
        ticker: Joi.string().required(),
        description: Joi.string(),
        url: Joi.string().required(),
        marketcap: Joi.number(),
        presale: Joi.number()
    });
    const inputValidation = UserSchema.validate(body);
    if (inputValidation.error) {
        io?.emit("TokenNotCreated")
        return res.status(400).json({ error: inputValidation.error.details[0].message })
    }
    // Check duplicated coin with same name or ticker
    const checkName = Coin.findOne({ name: body.name })
    if (checkName) return res.status(400).json({ error: "Duplicated coin Name" })
    const checkTicker = Coin.findOne({ ticker: body.ticker })
    if (checkTicker) return res.status(400).json({ error: "Duplicated coin Ticker" })
    // Create Token with UMI
    const token: any = await createToken({
        name: req.body.name,
        ticker: req.body.ticker,
        url: req.body.url,
        creator: req.body.creator,
        description: req.body.description,
        marketcap: parseFloat(req.body.marketcap),
        presale: parseFloat(req.body.presale)
    });

    if (token == "transaction failed") {
        io?.emit("TokenNotCreated")
        return res.status(400).json("failed")
    }

    return res.status(200).send(token)

})

export default router;
