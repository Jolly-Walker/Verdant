-- Add plan_id to execution_history
ALTER TABLE execution_history
ADD COLUMN plan_id UUID REFERENCES sequence_plans(id);

CREATE INDEX idx_execution_history_plan_id ON execution_history(plan_id);
