import { Router } from 'express';
import { AppDataSource } from '../data-source';
import { Workflow } from '../models/Workflow';
import { Task } from '../models/Task';
import {TaskStatus} from "../workers/taskRunner";

const router = Router();

/**
 * GET /workflow/:id/status
 * Retrieves the current status of a workflow
 */
router.get('/:id/status', async (req, res) => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id },
            relations: ['tasks']
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }

        const completedTasks = workflow.tasks.filter(t => t.status === TaskStatus.Completed).length;
        const totalTasks = workflow.tasks.length;

        res.status(200).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            completedTasks,
            totalTasks
        });
    } catch (error: any) {
        console.error('Error fetching workflow status:', error);
        res.status(500).json({ message: 'Failed to fetch workflow status' });
    }
});

/**
 * GET /workflow/:id/results
 * Retrieves the final results of a completed workflow
 */
router.get('/:id/results', async (req, res) => {
    const { id } = req.params;

    try {
        const workflowRepository = AppDataSource.getRepository(Workflow);
        const workflow = await workflowRepository.findOne({
            where: { workflowId: id }
        });

        if (!workflow) {
            return res.status(404).json({ message: 'Workflow not found' });
        }

        if (workflow.status !== 'completed') {
            return res.status(400).json({ message: 'Workflow is not yet completed' });
        }

        res.status(200).json({
            workflowId: workflow.workflowId,
            status: workflow.status,
            finalResult: workflow.finalResult ? JSON.parse(workflow.finalResult) : null
        });
    } catch (error: any) {
        console.error('Error fetching workflow results:', error);
        res.status(500).json({ message: 'Failed to fetch workflow results' });
    }
});

export default router;
