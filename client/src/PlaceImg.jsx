export default function PlaceImg({place,index=0,className=null}){
    if(!place.photos?.length){
        return '';
    }
    if(!className){
        className='object-cover h-32 w-32'
    }
    return (
            <img className={className} src={'http://localhost:4000/'+place.photos[index]} alt="" />
    )
}