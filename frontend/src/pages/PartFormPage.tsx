import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, ErrorDisplay, PageLoading } from '@/components/shared';
import { usePart, useProject, useCreatePart, useUpdatePart, useSettings } from '@/hooks/useApi';
import { PART_STATUS_MAP, PART_STATUSES, PART_PRIORITY_MAP, type PartStatus, type PartPriority } from '@/lib/types';

export function PartFormPage() {
  const navigate = useNavigate();
  const { id, projectId } = useParams<{ id?: string; projectId?: string }>();
  const [searchParams] = useSearchParams();
  const isEditing = !!id;

  const typeParam = searchParams.get('type') as 'part' | 'assembly' | null;
  const parentPartIdParam = searchParams.get('parentPartId');

  const { data: existingPart, isLoading: partLoading } = usePart(id || '');
  const actualProjectId = projectId || existingPart?.project_id || '';
  const { data: project, isLoading: projectLoading } = useProject(actualProjectId);
  const { data: settings } = useSettings();

  const createPart = useCreatePart();
  const updatePart = useUpdatePart();
  const hideUnusedFields = settings?.hide_unused_fields ?? false;

  const [name, setName] = useState('');
  const [type, setType] = useState<'part' | 'assembly'>(typeParam || 'part');
  const [status, setStatus] = useState<PartStatus>('designing');
  const [notes, setNotes] = useState('');
  const [sourceMaterial, setSourceMaterial] = useState('');
  const [haveMaterial, setHaveMaterial] = useState(false);
  const [quantity, setQuantity] = useState('');
  const [cutLength, setCutLength] = useState('');
  const [priority, setPriority] = useState<PartPriority>(1);
  const [drawingCreated, setDrawingCreated] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (existingPart) {
      setName(existingPart.name);
      setType(existingPart.type);
      setStatus(existingPart.status);
      setNotes(existingPart.notes || '');
      setSourceMaterial(existingPart.source_material || '');
      setHaveMaterial(existingPart.have_material);
      setQuantity(existingPart.quantity || '');
      setCutLength(existingPart.cut_length || '');
      setPriority(existingPart.priority);
      setDrawingCreated(existingPart.drawing_created);
    }
  }, [existingPart]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isEditing) {
        await updatePart.mutateAsync({
          id,
          name,
          status,
          notes,
          sourceMaterial,
          haveMaterial,
          quantity,
          cutLength,
          priority,
          drawingCreated,
        });
        navigate(`/parts/${id}`);
      } else {
        const part = await createPart.mutateAsync({
          projectId: actualProjectId,
          type,
          name,
          parentPartId: parentPartIdParam || undefined,
        });
        navigate(`/parts/${part.id}`);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const statusOptions = PART_STATUSES.map((s) => ({
    value: s,
    label: PART_STATUS_MAP[s],
  }));

  const priorityOptions = ([0, 1, 2] as PartPriority[]).map((p) => ({
    value: String(p),
    label: PART_PRIORITY_MAP[p],
  }));

  const typeOptions = [
    { value: 'part', label: 'Part' },
    { value: 'assembly', label: 'Assembly' },
  ];

  if ((isEditing && partLoading) || projectLoading) return <PageLoading />;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" asChild>
          <Link to={isEditing ? `/parts/${id}` : `/projects/${actualProjectId}`}>
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {isEditing ? 'Edit Part' : `New ${type === 'assembly' ? 'Assembly' : 'Part'}`}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{project?.name}</CardTitle>
          <CardDescription>
            {isEditing
              ? 'Update the part details below.'
              : `Create a new ${type} in this project.`}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-6">
            {error && <ErrorDisplay error={error} />}

            <div className="space-y-4">
              <h3 className="font-medium">Basic Information</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Drivetrain Gearbox"
                  required
                  className="sm:col-span-2"
                />
                {!isEditing && (
                  <Select
                    label="Type"
                    value={type}
                    onChange={(e) => setType(e.target.value as 'part' | 'assembly')}
                    options={typeOptions}
                  />
                )}
                {isEditing && (
                  <>
                    <Select
                      label="Status"
                      value={status}
                      onChange={(e) => setStatus(e.target.value as PartStatus)}
                      options={statusOptions}
                    />
                    <Select
                      label="Priority"
                      value={String(priority)}
                      onChange={(e) => setPriority(Number(e.target.value) as PartPriority)}
                      options={priorityOptions}
                    />
                  </>
                )}
              </div>
            </div>

            {isEditing && (
              <>
                {!hideUnusedFields && (
                  <div className="space-y-4">
                    <h3 className="font-medium">Material</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Input
                        label="Source Material"
                        value={sourceMaterial}
                        onChange={(e) => setSourceMaterial(e.target.value)}
                        placeholder="e.g., 1x2 aluminum tube"
                      />
                      <Input
                        label="Quantity"
                        value={quantity}
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="e.g., 4"
                      />
                      <Input
                        label="Cut Length"
                        value={cutLength}
                        onChange={(e) => setCutLength(e.target.value)}
                        placeholder="e.g., 12 inches"
                      />
                      <div className="flex items-center gap-2 pt-6">
                        <input
                          type="checkbox"
                          id="haveMaterial"
                          checked={haveMaterial}
                          onChange={(e) => setHaveMaterial(e.target.checked)}
                          className="rounded border-input"
                        />
                        <label htmlFor="haveMaterial" className="text-sm">
                          Have material in stock
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-4">
                  <h3 className="font-medium">Other</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="drawingCreated"
                      checked={drawingCreated}
                      onChange={(e) => setDrawingCreated(e.target.checked)}
                      className="rounded border-input"
                    />
                    <label htmlFor="drawingCreated" className="text-sm">
                      Drawing created
                    </label>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={4}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      placeholder="Any additional notes..."
                    />
                  </div>
                </div>
              </>
            )}
          </CardContent>
          <CardFooter className="flex gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate(isEditing ? `/parts/${id}` : `/projects/${actualProjectId}`)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={createPart.isPending || updatePart.isPending}
              className="flex-1"
            >
              {isEditing ? 'Save Changes' : 'Create'}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
