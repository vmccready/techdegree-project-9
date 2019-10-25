'use strict';

const express = require('express');
const db = require('./models/index');
const { User, Course } = db;
const { check, validationResult } = require('express-validator');
const bcryptjs = require('bcryptjs');
const auth = require('basic-auth');

const router = express.Router();

// Async handler
function asyncHandler(callback) {
  return async(req, res, next) => {
    try{
      await callback(req, res, next);
    } catch(err) {
      // if (error.name === 'SequelizeValidationError') {
      //   const errors = error.errors.map(err => err.message);
      //   console.error('Validation errors: ', errors);
      //   next(error);
      // } else {
      //   next(error);
      // }
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

// Show all users
// router.get('/user', (req, res) => {
//   (async ()=> {
//     try{
//       const users = await User.findAll();
//       res.json(users);
//     } catch(error) {
//       res.json({message: error.message});
//     }
//   })();
// });

router.get('/users', authenticateUser, (req, res) => {
  const user = req.currentUser;

  res.json({
    name: `${user.firstName} ${user.lastName}`,
  });
});

// router.post('/users',userValidators, async(req, res) => {
//   try{
//     const errors = validationResult(req);
//     if (!errors.isEmpty()) {
//       const errorMessages = errors.array().map(error => error.msg);
//       return res.status(400).json({ errors: errorMessages });
//     } 
//     const user = req.body;

//     user.password = bcryptjs.hashSync(user.password);
//     await User.create(user);
//     res.status(201).end();
//   } catch(error) {
//     if (error.name === 'SequelizeValidationError') {
//       const errors = error.errors.map(err => err.message);
//       console.error('Validation errors: ', errors);
//     } else {
//       next(error);
//     }
//   }
// });

router.post('/users',userValidators, asyncHandler( async(req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const err = new Error();
    err.status= 400;
    err.message = errorMessages;
    throw err;
  } 
  const user = req.body;

  user.password = bcryptjs.hashSync(user.password);
  await User.create(user);
  res.status(201).end();
}));

router.get('/courses', asyncHandler(async (req, res) => {
  const courses = await Course.findAll({
    include: [{ model: User }]
  });
  res.json(courses);
}));

router.get('/courses/:id', asyncHandler( async (req, res, next) => {
  const course = await Course.findOne({
    include: [{ model: User }],
    where: { id: req.params.id }
  });
  if (course) {
      res.json(course);
  } else {
    next();
  }

}));

router.post('/courses', [ authenticateUser, courseValidators ] , asyncHandler( async(req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    const err = new Error();
    err.status= 400;
    err.message = errorMessages;
    throw err;
  } 
  const course = req.body;

  await Course.create(course);
  res.status(201).end();

}));

router.put('/courses/:id', [ authenticateUser, courseValidators ], asyncHandler( async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => error.msg);
    return res.status(400).json({ errors: errorMessages });
  } 
  const update = req.body;
  const course = await Course.findOne({
    include: [{ model: User }],
    where: { id: req.params.id }
  });
  course.update(update);

  // return no content
  res.json(course);
}));

router.delete('/courses/:id', authenticateUser, asyncHandler( async (req, res, next) => {
  const course = await Course.findOne({
    include: [{ model: User }],
    where: { id: req.params.id }
  });
  if (course) {
    course.destroy();
    res.send(204);
  } else {
    // res.send(404);
    next();
  }

}));

module.exports = router;