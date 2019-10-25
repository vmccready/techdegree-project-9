'use strict';
const Sequelize = require('sequelize');
module.exports = (sequelize) => {
  const Course = sequelize.define('Course', {
    id: {
      type: Sequelize.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: Sequelize.INTEGER
    },
    title: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    description:{
      type: Sequelize.STRING,
      allowNull: false,
    },
    estimatedTime: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    materialsNeeded: {
      type: Sequelize.STRING,
      allowNull: true,
    },
  }, {});
  Course.associate = function(models) {
    Course.belongsTo(models.User, { foreignKey: 'userId' });
  };
  return Course;
};