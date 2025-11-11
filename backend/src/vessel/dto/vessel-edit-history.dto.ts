import { ApiProperty } from '@nestjs/swagger';

export class VesselEditHistoryDto {
  @ApiProperty({ description: 'Edit history ID', example: 1 })
  id: number;

  @ApiProperty({ description: 'Vessel ID', example: 1 })
  vesselId: number;

  @ApiProperty({ description: 'User who made the edit', example: 1 })
  userId: number;

  @ApiProperty({ description: 'Username of the editor', example: 'john_doe' })
  userName: string;

  @ApiProperty({
    description: 'Changes made (JSON)',
    example: '{"vesselName":"Titanic","flag":"GB"}',
  })
  changes: Record<string, any>;

  @ApiProperty({ description: 'When the edit was made' })
  editedAt: Date;
}

export class VesselEditHistoryResponseDto {
  @ApiProperty({ type: [VesselEditHistoryDto] })
  data: VesselEditHistoryDto[];

  @ApiProperty({ description: 'Total count' })
  total: number;
}
