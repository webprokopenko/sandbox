import { Job } from './Job';
import { Task } from '../models/Task';

export class PolygonAreaJob implements Job {
    async run(task: Task): Promise<number> {
        console.log(`Calculating polygon area for task ${task.taskId}...`);

        try {
            const inputGeometry = JSON.parse(task.geoJson);

            // Validate GeoJSON
            if (!inputGeometry || !inputGeometry.geometry) {
                throw new Error('Invalid GeoJSON: missing geometry');
            }

            if (inputGeometry.geometry.type !== 'Polygon') {
                throw new Error('Invalid GeoJSON: must be Polygon');
            }

            // Calculate area using shoelace formula (returns approximate area in square degrees)
            const coordinates = inputGeometry.geometry.coordinates[0];
            const area = this.calculatePolygonArea(coordinates);

            console.log(`Polygon area calculated: ${area} square degrees`);
            return area;

        } catch (error: any) {
            console.error(`Error calculating polygon area for task ${task.taskId}:`, error);
            throw new Error(`Failed to calculate polygon area: ${error.message}`);
        }
    }

    private calculatePolygonArea(coordinates: number[][]): number {
        let area = 0;
        const n = coordinates.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += coordinates[i][0] * coordinates[j][1];
            area -= coordinates[j][0] * coordinates[i][1];
        }

        return Math.abs(area / 2);
    }
}
