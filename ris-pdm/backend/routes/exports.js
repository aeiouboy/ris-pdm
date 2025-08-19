const express = require('express');
const { query, param, validationResult } = require('express-validator');
const router = express.Router();
const logger = require('../utils/logger');
const ExportService = require('../src/services/exportService');

/**
 * @route   GET /api/exports/dashboard/pdf
 * @desc    Export dashboard overview as PDF
 * @access  Private
 */
router.get('/dashboard/pdf',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', startDate, endDate } = req.query;
      
      logger.info(`Generating PDF export for dashboard overview`, {
        period,
        startDate,
        endDate,
        userId: req.user?.id,
      });

      const pdfBuffer = await ExportService.generateDashboardPDF({
        period,
        startDate,
        endDate,
        user: req.user
      });

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ris-dashboard-${period}-${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      logger.error('PDF export failed:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/exports/dashboard/excel
 * @desc    Export dashboard overview as Excel
 * @access  Private
 */
router.get('/dashboard/excel',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', startDate, endDate } = req.query;
      
      logger.info(`Generating Excel export for dashboard overview`, {
        period,
        startDate,
        endDate,
        userId: req.user?.id,
      });

      const excelBuffer = await ExportService.generateDashboardExcel({
        period,
        startDate,
        endDate,
        user: req.user
      });

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ris-dashboard-${period}-${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Length': excelBuffer.length,
      });

      res.send(excelBuffer);
    } catch (error) {
      logger.error('Excel export failed:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/exports/individual/:userId/pdf
 * @desc    Export individual performance as PDF
 * @access  Private
 */
router.get('/individual/:userId/pdf',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { userId } = req.params;
      const { period = 'sprint', startDate, endDate } = req.query;
      
      logger.info(`Generating PDF export for individual performance`, {
        userId,
        period,
        startDate,
        endDate,
        requesterId: req.user?.id,
      });

      const pdfBuffer = await ExportService.generateIndividualPDF({
        userId,
        period,
        startDate,
        endDate,
        user: req.user
      });

      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_.]/g, '-');
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="ris-individual-${sanitizedUserId}-${period}-${new Date().toISOString().split('T')[0]}.pdf"`,
        'Content-Length': pdfBuffer.length,
      });

      res.send(pdfBuffer);
    } catch (error) {
      logger.error('Individual PDF export failed:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/exports/individual/:userId/excel
 * @desc    Export individual performance as Excel
 * @access  Private
 */
router.get('/individual/:userId/excel',
  [
    param('userId').notEmpty().withMessage('User ID is required'),
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { userId } = req.params;
      const { period = 'sprint', startDate, endDate } = req.query;
      
      logger.info(`Generating Excel export for individual performance`, {
        userId,
        period,
        startDate,
        endDate,
        requesterId: req.user?.id,
      });

      const excelBuffer = await ExportService.generateIndividualExcel({
        userId,
        period,
        startDate,
        endDate,
        user: req.user
      });

      const sanitizedUserId = userId.replace(/[^a-zA-Z0-9-_.]/g, '-');
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ris-individual-${sanitizedUserId}-${period}-${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Length': excelBuffer.length,
      });

      res.send(excelBuffer);
    } catch (error) {
      logger.error('Individual Excel export failed:', error);
      next(error);
    }
  }
);

/**
 * @route   GET /api/exports/team-data/excel
 * @desc    Export complete team data as Excel
 * @access  Private
 */
router.get('/team-data/excel',
  [
    query('period').optional().isIn(['sprint', 'month', 'quarter', 'year']).withMessage('Invalid period'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          code: 'VALIDATION_ERROR',
          details: errors.array(),
          timestamp: new Date().toISOString(),
        });
      }

      const { period = 'sprint', startDate, endDate } = req.query;
      
      logger.info(`Generating Excel export for complete team data`, {
        period,
        startDate,
        endDate,
        userId: req.user?.id,
      });

      const excelBuffer = await ExportService.generateTeamDataExcel({
        period,
        startDate,
        endDate,
        user: req.user
      });

      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="ris-team-data-${period}-${new Date().toISOString().split('T')[0]}.xlsx"`,
        'Content-Length': excelBuffer.length,
      });

      res.send(excelBuffer);
    } catch (error) {
      logger.error('Team data Excel export failed:', error);
      next(error);
    }
  }
);

module.exports = router;