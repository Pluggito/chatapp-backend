const express = require('express');
const { userSignUp, userSignIn, currentUser, refreshAccessToken, userSignout, checkRefreshToken  } = require('../controllers/authcontrollers')
const validateTokenHandler = require('../middleware/validateTokenHandler');
const router = express.Router();

router.post('/signUp', userSignUp);
router.post('/signIn', userSignIn);
router.get('/current', validateTokenHandler, currentUser);
router.post('/refresh', refreshAccessToken);
router.post('/signOut', userSignout);
router.get('/check-refresh', checkRefreshToken);

module.exports = router;
