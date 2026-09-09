require('ts-node/register/transpile-only');
const { DataSource } = require('typeorm');
const {
  AdmissionService,
} = require('../src/common/admission/admission.service');

process.on(
  'message',
  async ({
    url,
    action = 'reserve-upload',
    config: values = {},
    userId,
    uploadId,
    bytes = 1024,
    address,
    operationId,
  }) => {
    const source = new DataSource({ type: 'postgres', url });
    try {
      await source.initialize();
      const config = {
        get: (key) => ({ DEPLOYMENT_ENV: 'preview', ...values })[key],
      };
      const admission = new AdmissionService(source, config);
      if (action === 'admit-demo') {
        await admission.admitDemo(address, operationId);
      } else {
        await admission.reserveUpload({ userId, uploadId, bytes });
      }
      process.send({ ok: true });
    } catch (error) {
      process.send({ ok: false, status: error?.getStatus?.() });
    } finally {
      await source.destroy().catch(() => undefined);
      process.exit(0);
    }
  },
);
