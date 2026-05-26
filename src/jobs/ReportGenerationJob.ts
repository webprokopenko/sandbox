import { Job } from './Job';
import { Task } from '../models/Task';

interface ReportTask {
    taskId: string;
    type: string;
    output: any;
    error?: string;
}

interface WorkflowReport {
    workflowId: string;
    tasks: ReportTask[];
    finalReport: string;
}

export class ReportGenerationJob implements Job {
    async run(task: Task): Promise<WorkflowReport> {
        console.log(`Generating report for task ${task.taskId}...`);

        try {
            // Get all tasks in the workflow
            const workflow = task.workflow;
            if (!workflow || !workflow.tasks) {
                throw new Error('Task has no associated workflow');
            }

            const tasks: ReportTask[] = [];

            // Aggregate outputs from all tasks in the workflow
            // Note: In a real implementation, you'd fetch results from the Result entity
            // For now, we'll create a summary based on task status
            for (const workflowTask of workflow.tasks) {
                let output: any = null;
                let error: string | undefined;

                if (workflowTask.status === 'completed') {
                    output = { status: 'completed', stepNumber: workflowTask.stepNumber };
                } else if (workflowTask.status === 'failed') {
                    error = 'Task failed';
                } else {
                    error = 'Task not completed';
                }

                tasks.push({
                    taskId: workflowTask.taskId,
                    type: workflowTask.taskType,
                    output,
                    error,
                });
            }

            // Create final report
            const report: WorkflowReport = {
                workflowId: workflow.workflowId,
                tasks,
                finalReport: `Aggregated data and results for workflow ${workflow.workflowId}`,
            };

            console.log(`Report generated for workflow ${workflow.workflowId}`);
            return report;

        } catch (error: any) {
            console.error(`Error generating report for task ${task.taskId}:`, error);
            throw new Error(`Failed to generate report: ${error.message}`);
        }
    }
}
