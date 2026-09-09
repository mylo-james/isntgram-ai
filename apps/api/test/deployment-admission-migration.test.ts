import { AddDeploymentAdmission1790000000000 } from '../src/migrations/1790000000000-AddDeploymentAdmission';

describe('AddDeploymentAdmission1790000000000', () => {
  it('creates and removes all durable admission tables and active indexes', async () => {
    const query = jest.fn();
    const migration = new AddDeploymentAdmission1790000000000();

    await migration.up({ query } as never);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('deployment_admission_windows'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('deployment_operation_leases'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('deployment_upload_reservations'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_DEPLOYMENT_OPERATION_LEASES_ACTIVE'),
    );
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('IDX_DEPLOYMENT_UPLOAD_RESERVATIONS_LIVE'),
    );

    query.mockClear();
    await migration.down({ query } as never);
    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'DROP TABLE IF EXISTS deployment_upload_reservations',
      'DROP TABLE IF EXISTS deployment_operation_leases',
      'DROP TABLE IF EXISTS deployment_admission_windows',
    ]);
  });
});
