'use strict';

const express = require('express');
const db = require('./models/index');
const { User, Course } = db;
const { body, check, validationResult } = require('express-validator');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');

const router = express.Router();

// Async handler
function asyncHandler(callback) {
  return async(req, res, next) => {
    try{
      await callback(req, res, next);
    } catch(err) {
      next(err);
    }
  }
}

// Validate user data
const userValidators = [
  check('firstName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "first name"'),
  check('lastName')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "last name"'),
  check('emailAddress')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "email address"'),
  check('password')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "password"'),
];

// Validate email
// regex validator from https://stackoverflow.com/questions/46155/how-to-validate-an-email-address-in-javascript

function validateEmail(email) {
  var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
  return re.test(email);
}
const emailValidator = body('emailAddress').custom( email => {
  // See if email already used
  return User.findOne({
    where: { emailAddress: email.toLowerCase() }
  })
  .then( user => {
    // Reject if email is in use
    if (user) { return Promise.reject('Email already in use') }

    // reject if invalid email
    if (!validateEmail(email)) { return Promise.reject('Not a valid E-mail address') }
  })
});

// Validate Course data
const courseValidators = [
  check('title')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "first name"'),
  check('description')
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage('Please provide a value for "last name"'),
];

// Authenticate user
const authenticateUser = async (req, res, next) => {
  // instantiate message for possible errors
  let message = null;
  // get credential from request
  const credentials = auth(req);

  if (credentials) {
    // Find user that matches credentials
    const user = await User.findOne({
      where: { emailAddress: credentials.name }
    });

    if (user) {
      // Authenticate password with stored password
      const authenticated = bcryptjs
        .compareSync(credentials.pass, user.password);
      
      if (authenticated) {
        console.log(`Authentication successful for username: ${user.username}`);
        // Return user from data to request
        req.currentUser = user;
      } else {
        console.log(user);
        message = `Authentication failure for username: ${user.username}`;
      }
    } else {
      message = `User not found for username: ${credentials.name}`;
    }
  } else {
    message = 'Auth header not found';
  }

  if (message) {
    // if any step of authentication fails, deny access
    res.status(401).json({ message: 'Access Denied'});
  } else {
    // continue to next if authenticated
    next();
  }
}

// Get user from authentication header
router.get('/users', authenticateUser, (req, res) => {
  const user = req.currentUser;

  // Send user data
  res.json({
    name: `${user.firstName} ${user.lastName}`,
  });
});

// Create user
router.post('/users', [userValidators, emailValidator], asyncHandler( async(req, res, next) => {
  // Validate user data
  const errors = validationResult(req);

  // throw error if validation errors
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const err = new Error();
    err.status= 400;
    err.message = errorMessages;
    throw err;
  } 

  // Get user data from request
  const user = req.body;
  user.emailAddress = user.emailAddress.toLowerCase();

  // Hash password and create user
  user.password = bcryptjs.hashSync(user.password);
  await User.create(user);
  res.location('/').status(201).end();
}));

// Get all courses
router.get('/courses', asyncHandler(async (req, res) => {
  const courses = await Course.findAll({
    attributes: { exclude: ['createdAt', 'updatedAt'] },
    // include user data
    include: [{ 
      model: User , 
      attributes: { exclude: ['password', 'createdAt', 'updatedAt'] },
    }]
  });
  res.json(courses);
}));

// Get specific course by id
router.get('/courses/:id', asyncHandler( async (req, res, next) => {
  // Find course by id
  const course = await Course.findOne({
    attributes: { exclude: ['createdAt', 'updatedAt'] },
    include: [{ 
      model: User, 
      attributes: { exclude: ['password', 'createdAt', 'updatedAt'] }, 
    }],
    where: { id: req.params.id }
  });

  // Send data if course exists, or next to 404
  if (course) {
      res.json(course);
  } else { next() }
}));

// Create a course
router.post('/courses', [ authenticateUser, courseValidators ] , asyncHandler( async(req, res, next) => {
  // Validate course data
  const errors = validationResult(req);

  // throw error if not validated
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const err = new Error();
    err.status= 400;
    err.message = errorMessages;
    throw err;
  } 

  // create course from request data
  const course = await Course.create(req.body);

  // set location and status
  res.location(`api/courses/${course.id}`).status(201).end();
}));

// Update a course
router.put('/courses/:id', [ authenticateUser, courseValidators ], asyncHandler( async (req, res, next) => {
  // validate req data
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const err = new Error();
    err.status= 400;
    err.message = errorMessages;
    throw err;
  } 

  // get course to update
  const update = req.body;
  const course = await Course.findOne({
    include: [{ model: User }],
    where: { id: req.params.id }
  });



  // update if course exists
  if(course) {
    // only course owner can change this course
    if (course.userId != req.currentUser.id) {
      res.status(403).end();
    }

    course.update(update);
    res.status(204).end();
  } else {
    next();
  }  
}));

// Delete a course
router.delete('/courses/:id', authenticateUser, asyncHandler( async (req, res, next) => {
  // get course to delete
  const course = await Course.findOne({
    include: [{ model: User }],
    where: { id: req.params.id }
  });

  // delete if exists
  if (course) {
    // only course owner can change this course
    if (course.userId != req.currentUser.id) {
      res.status(403).end();
    }

    course.destroy();
    res.status(204).end();
  } else {
    next();
  }

}));

module.exports = router;