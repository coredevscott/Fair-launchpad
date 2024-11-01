// routes/users.js
import express from 'express';
import User from '../models/User';
import PendingUser from '../models/PendingUser';
import crypto from 'crypto'
import Joi from 'joi';
import base58 from 'bs58';
import nacl from 'tweetnacl';
import { PublicKey, Transaction } from '@solana/web3.js';
import { auth } from '../middleware/authorization';
import * as jwt from 'jsonwebtoken';

const idSchema = Joi.string().required();

const router = express.Router();


// @route   POST api/user/login
// @desc    Resgister user
// @access  Public
router.post('/login', async (req, res) => {
    // Validate form
    const { body } = req;
    const UserSchema = Joi.object().keys({
        name: Joi.string().required(),
        wallet: Joi.string().required(),
        isLedger: Joi.boolean().optional().required(),
    });

    const inputValidation = UserSchema.validate(body);
    if (inputValidation.error) {
        res.status(400).json({ error: inputValidation.error.details[0].message });
    }
    const wallet = body.wallet;

    const existingPendingUser = await PendingUser.findOne({ wallet });
    if (!existingPendingUser) {
        const newUser = await User.findOne({ wallet });
        const nonce = crypto.randomBytes(8).toString('hex');
        const newPendingUser = new PendingUser({
            name: body.name,
            wallet,
            nonce,
            isLedger: body.isLedger,
            new: newUser ? false : true,
        });
        newPendingUser.save()
            .then((user: PendingUserInfo) => {
                res.status(200).send(user);
            });
    } else {
        res.status(400).json({ message: "A user with this wallet already requested." });
    }
});

// @route   POST api/user/confirm
// @desc    Confirm and Register user
// @access  Public
router.post('/confirm', async (req, res) => {
    const body = {
        name: req.body.name,
        wallet: req.body.wallet,
        isLedger: req.body.isLedger,
        signature: req.body.signature,
        nonce: req.body.nonce,
    }
    // Validate form
    const UserSchema = Joi.object().keys({
        name: Joi.string().required(),
        wallet: Joi.string().required(),
        nonce: Joi.string().required(),
        signature: Joi.string().required(),
        isLedger: Joi.boolean().optional().required(),
    })
    const inputValidation = UserSchema.validate(body);
    console.log(inputValidation)
    if (inputValidation.error) {
        return res.status(400).json({ error: inputValidation.error.details[0].message })
    }
    try {

        const foundNonce = await PendingUser.findOneAndDelete({ nonce: body.nonce }).exec();
        if (!foundNonce) return res.status(400).json("Your request expired")

        // nonce  decode!!
        if (!body.isLedger) {
            const signatureUint8 = base58.decode(body.signature);
            const msgUint8 = new TextEncoder().encode(`${process.env.SIGN_IN_MSG} ${foundNonce.nonce}`);
            const pubKeyUint8 = base58.decode(body.wallet);
            const isValidSignature = nacl.sign.detached.verify(msgUint8, signatureUint8, pubKeyUint8);
            if (!isValidSignature) return res.status(404).json({ error: "Invalid signature" })
        } else {
            const ledgerSerializedTx = JSON.parse(body.signature);
            const signedTx = Transaction.from(Uint8Array.from(ledgerSerializedTx));

            const feePayer = signedTx.feePayer?.toBase58() || "";

            if (feePayer != body.wallet) {
                return res.status(400).json({ error: "Invalid wallet or fee payer" });
            }

            const MEMO_PROGRAM_ID = new PublicKey(
                "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
            );

            const inx = signedTx.instructions.find(
                (ix) => ix.programId.toBase58() == MEMO_PROGRAM_ID.toBase58()
            );

            if (!inx) {
                return res
                    .status(503)
                    .json({ error: "Memo program couldn't be verified" });
            }

            if (!signedTx.verifySignatures()) {
                return res
                    .status(503)
                    .json({ error: "Could not verify signatures" });
            }
        }
        const userData = await User.findOne({ wallet: body.wallet });
        if (userData) {
            const token = `${jwt.sign({ user: userData }, process.env.JWT_SECRET!)}`;
            res.status(200).send({ user: userData, token });
            return;
        } else {
            const userData = {
                name: body.name,
                wallet: body.wallet,
            };
            const newUser = new User(userData);
            const savedUser = await newUser.save();
            const token = jwt.sign({ user: savedUser }, process.env.JWT_SECRET!);
            res.status(200).send({ user: savedUser, token });
        }
    } catch (error) {
        console.log("Error: ", error)

    }
});
// @route   POST api/user/update/:id
// @desc    Update user
// @access  Private
router.post('/update/:id', auth, async (req, res) => {
    const { error } = idSchema.validate(req.params.id);
    if (error) return res.status(400).send("Invalid ID format");

    const { body } = req;
    const userId = req.params.id;
    // Validate form
    const UserSchema = Joi.object().keys({
        name: Joi.string().required(),
        wallet: Joi.string().required(),
        avatar: Joi.string().required(),
    })
    const inputValidation = UserSchema.validate(body);
    if (inputValidation.error) {
        return res.status(400).json({ error: inputValidation.error.details[0].message })
    }
    try {
        const updatedUser = await User.updateOne({ _id: userId }, { $set: body })
        res.status(200).send(updatedUser);
    } catch (err) {
        res.status(500).send(err);
    }
});

// @route   POST api/user/
// @desc    Get all user
// @access  Public
router.get('/', async (req, res) => {
    try {
        const users = await User.find({});
        res.status(200).send(users);
    } catch (error) {
        res.status(500).send(error);
    }
});

// @route   POST api/user/:id
// @desc    Get user
// @access  Public
router.get('/:id', async (req, res) => {
    const { error } = idSchema.validate(req.params.id);
    if (error) return res.status(400).send("Invalid ID format");

    const id = req.params.id;
    try {
        const user = await User.findOne({ _id: id });
        if(!user) return res.status(404).send({"User not found"})
        res.status(200).send(user);
    } catch (error) {
        res.status(404).send(error);
    }
});



export default router;

export interface UserInfo {
    name: string,
    wallet: string,
    avatar?: string
}

export interface PendingUserInfo {
    name: string,
    wallet: string,
    nonce: string,
}