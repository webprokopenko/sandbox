import { Repository } from 'typeorm';
import { Task } from '../models/Task';
import { getJobForTaskType } from '../jobs/JobFactory';
import {WorkflowStatus} from "../workflows/WorkflowFactory";
import {Workflow} from "../models/Workflow";
import {Result} from "../models/Result";

export enum TaskStatus {
    Queued = 'queued',
    InProgress = 'in_progress',
    Completed = 'completed',
    Failed = 'failed'
}

export class TaskRunner {
    constructor(
        private taskRepository: Repository<Task>,
    ) {}

    /**
     * Checks if a task's dependencies are satisfied.
     * @param task - The task to check dependencies for.
     * @returns True if all dependencies are satisfied, false otherwise.
     */
    private async areDependenciesSatisfied(task: Task): Promise<boolean> {
        if (!task.dependsOnTaskId) {
            return true; // No dependencies
        }

        const dependentTask = await this.taskRepository.findOne({
            where: { taskId: task.dependsOnTaskId }
        });

        if (!dependentTask) {
            console.error(`Dependency task ${task.dependsOnTaskId} not found for task ${task.taskId}`);
            return false;
        }

        return dependentTask.status === TaskStatus.Completed;
    }

    /**
     * Aggregates results from all tasks in a workflow and saves to finalResult field.
     * @param workflow - The workflow to aggregate results for.
     * @param resultRepository - The Result repository for fetching task results.
     */
    private async aggregateWorkflowResults(workflow: Workflow, resultRepository: Repository<Result>): Promise<void> {
        const results: any[] = [];

        for (const task of workflow.tasks) {
            if (task.status === TaskStatus.Completed && task.resultId) {
                const result = await resultRepository.findOne({
                    where: { resultId: task.resultId }
                });
                if (result) {
                    results.push({
                        taskId: task.taskId,
                        taskType: task.taskType,
                        stepNumber: task.stepNumber,
                        output: JSON.parse(result.data || '{}')
                    });
                }
            } else if (task.status === TaskStatus.Failed) {
                results.push({
                    taskId: task.taskId,
                    taskType: task.taskType,
                    stepNumber: task.stepNumber,
                    error: 'Task failed'
                });
            }
        }

        workflow.finalResult = JSON.stringify({
            workflowId: workflow.workflowId,
            totalTasks: workflow.tasks.length,
            completedTasks: results.filter(r => !r.error).length,
            failedTasks: results.filter(r => r.error).length,
            results
        });

        console.log(`Aggregated results for workflow ${workflow.workflowId}`);
    }

    /**
     * Runs the appropriate job based on the task's type, managing the task's status.
     * @param task - The task entity that determines which job to run.
     * @throws If the job fails, it rethrows the error.
     */
    async run(task: Task): Promise<void> {
        task.status = TaskStatus.InProgress;
        task.progress = 'starting job...';
        await this.taskRepository.save(task);
        const job = getJobForTaskType(task.taskType);

        try {
            console.log(`Starting job ${task.taskType} for task ${task.taskId}...`);
        // Check if dependencies are satisfied
        const dependenciesSatisfied = await this.areDependenciesSatisfied(task);
        if (!dependenciesSatisfied) {
            console.log(`Task ${task.taskId} dependencies not satisfied, skipping...`);
            return;
        }

            const resultRepository = this.taskRepository.manager.getRepository(Result);
            const taskResult = await job.run(task);
            console.log(`Job ${task.taskType} for task ${task.taskId} completed successfully.`);
            const result = new Result();
            result.taskId = task.taskId!;
            result.data = JSON.stringify(taskResult || {});
            await resultRepository.save(result);
            task.resultId = result.resultId!;
            task.status = TaskStatus.Completed;
            task.progress = null;
            await this.taskRepository.save(task);

        } catch (error: any) {
            console.error(`Error running job ${task.taskType} for task ${task.taskId}:`, error);

            task.status = TaskStatus.Failed;
            task.progress = null;
            await this.taskRepository.save(task);

            throw error;
        }

        const workflowRepository = this.taskRepository.manager.getRepository(Workflow);
        const currentWorkflow = await workflowRepository.findOne({ where: { workflowId: task.workflow.workflowId }, relations: ['tasks'] });

        if (currentWorkflow) {
            const allCompleted = currentWorkflow.tasks.every(t => t.status === TaskStatus.Completed);
            const anyFailed = currentWorkflow.tasks.some(t => t.status === TaskStatus.Failed);

            if (anyFailed) {
                currentWorkflow.status = WorkflowStatus.Failed;
            } else if (allCompleted) {
                currentWorkflow.status = WorkflowStatus.Completed;
            } else {
                currentWorkflow.status = WorkflowStatus.InProgress;
            }

            await workflowRepository.save(currentWorkflow);
        }
    }
}