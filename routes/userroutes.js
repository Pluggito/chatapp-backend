const express = require("express");
const router = require("express").Router();
const { getUsers, getUserBySearch } = require("../controllers/usercontroller");

router.get('/search', getUserBySearch);

module.exports = router;